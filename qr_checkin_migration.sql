-- ==============================================================================
-- 🥋 ZR TEAM — SISTEMA DE CHECK-IN POR QR CODE
-- Migração: daily_qr_codes + RPCs
-- Como usar: Colar no SQL Editor do Supabase e executar
-- ==============================================================================

-- 1. TABELA DE CÓDIGOS QR DIÁRIOS
-- Guarda o token secreto de cada dia (gerado automaticamente)
CREATE TABLE IF NOT EXISTS public.daily_qr_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  code text NOT NULL,
  valid_date date NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT daily_qr_codes_pkey PRIMARY KEY (id),
  CONSTRAINT daily_qr_codes_valid_date_key UNIQUE (valid_date),
  CONSTRAINT daily_qr_codes_code_key UNIQUE (code)
);
ALTER TABLE public.daily_qr_codes ENABLE ROW LEVEL SECURITY;

-- Utilizadores autenticados podem ler o código do dia (para a app)
DROP POLICY IF EXISTS "auth_read_daily_qr" ON public.daily_qr_codes;
CREATE POLICY "auth_read_daily_qr" ON public.daily_qr_codes
  FOR SELECT TO authenticated USING (true);

-- Utilizadores anónimos podem ler o código do dia (para a página pública do tablet)
DROP POLICY IF EXISTS "anon_read_daily_qr" ON public.daily_qr_codes;
CREATE POLICY "anon_read_daily_qr" ON public.daily_qr_codes
  FOR SELECT TO anon USING (valid_date = CURRENT_DATE);

-- Apenas service_role insere (via RPC SECURITY DEFINER)
-- Nota: não precisamos de policy de INSERT para authenticated/anon
-- porque a RPC usa SECURITY DEFINER e corre com permissões elevadas.


-- ==============================================================================
-- 2. RPC: Obter (ou criar) o código QR do dia
-- Chamada pelo frontend para obter o código a exibir no QR.
-- Usa SECURITY DEFINER para poder inserir sem policy de INSERT pública.
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_daily_qr()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := CURRENT_DATE;
  v_code text;
BEGIN
  -- Tenta obter o código existente para hoje
  SELECT code INTO v_code
  FROM public.daily_qr_codes
  WHERE valid_date = v_today;

  -- Se não existe, cria um novo
  IF v_code IS NULL THEN
    v_code := gen_random_uuid()::text;
    INSERT INTO public.daily_qr_codes (code, valid_date)
    VALUES (v_code, v_today)
    ON CONFLICT (valid_date) DO UPDATE
      SET code = daily_qr_codes.code  -- Não sobrescreve se já foi criado entretanto (race condition)
    RETURNING code INTO v_code;
  END IF;

  RETURN v_code;
END;
$$;

-- Permitir que utilizadores autenticados e anónimos chamem esta função
GRANT EXECUTE ON FUNCTION public.get_or_create_daily_qr() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_daily_qr() TO anon;


-- ==============================================================================
-- 3. RPC: Auto check-in do atleta via QR Code
-- Chamada pelo atleta autenticado após leitura do QR.
-- Toda a lógica de validação corre no servidor (seguro contra manipulação).
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.qr_self_checkin(qr_code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := CURRENT_DATE;
  v_valid_code text;
  v_now timestamptz := NOW();
  v_booking_id uuid;
  v_class_title text;
  v_class_start text;
BEGIN
  -- Segurança: só utilizadores autenticados podem chamar
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- 1. Verificar se o código QR é válido para hoje
  SELECT code INTO v_valid_code
  FROM public.daily_qr_codes
  WHERE valid_date = v_today;

  IF v_valid_code IS NULL OR v_valid_code <> qr_code_param THEN
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  -- 2. Encontrar a primeira marcação elegível (por janela horária)
  --    Janela: 30 minutos antes do início até 60 minutos após o fim
  --    Em caso de múltiplas aulas elegíveis, conta a primeira (start_time ASC)
  SELECT cb.id, c.title, c.start_time::text
  INTO v_booking_id, v_class_title, v_class_start
  FROM public.class_bookings cb
  JOIN public.classes c ON c.id = cb.class_id
  WHERE cb.user_id = v_user_id
    AND c.date = v_today
    AND cb.status = 'Marcado'  -- Só marcações ainda por confirmar
    AND (c.date + c.start_time - interval '30 minutes') <= v_now
    AND (c.date + c.end_time + interval '60 minutes') >= v_now
  ORDER BY c.start_time ASC
  LIMIT 1;

  -- 3. Sem marcação válida na janela horária
  IF v_booking_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'reason', 'no_booking');
  END IF;

  -- 4. Marcar como Presente + registar auditoria
  UPDATE public.class_bookings
  SET
    status         = 'Presente',
    checkin_method = 'qr_self',
    checkin_at     = v_now,
    checkin_by_id  = NULL  -- O próprio atleta fez check-in
  WHERE id = v_booking_id;

  -- 5. Incrementar contador de aulas assistidas
  PERFORM public.increment_attended_classes(v_user_id);

  RETURN jsonb_build_object(
    'success', true,
    'class_title', v_class_title,
    'start_time', v_class_start
  );
END;
$$;

-- Apenas utilizadores autenticados podem fazer self check-in
GRANT EXECUTE ON FUNCTION public.qr_self_checkin(text) TO authenticated;


-- ==============================================================================
-- 4. COLUNAS DE AUDITORIA em class_bookings
-- Regista como e quando cada check-in foi feito e quem o fez.
-- ==============================================================================

-- Método do check-in: 'qr_self' (atleta leu o QR) ou 'manual_professor' (professor)
ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS checkin_method text
    CHECK (checkin_method IS NULL OR checkin_method IN ('qr_self', 'manual_professor'));

-- Timestamp exato do check-in (null enquanto o status é 'Marcado' ou 'Falta')
ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS checkin_at timestamptz DEFAULT NULL;

-- Quem fez o check-in: UUID do professor (check-in manual) ou NULL (QR pelo próprio atleta)
ALTER TABLE public.class_bookings
  ADD COLUMN IF NOT EXISTS checkin_by_id uuid DEFAULT NULL
    REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Índice para queries de auditoria (ex: "todos os QR check-ins de hoje")
CREATE INDEX IF NOT EXISTS idx_class_bookings_checkin_method
  ON public.class_bookings (checkin_method) WHERE checkin_method IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_class_bookings_checkin_at
  ON public.class_bookings (checkin_at DESC) WHERE checkin_at IS NOT NULL;


-- ==============================================================================
-- 5. RPC: Revert check-in com limpeza de auditoria
-- Ao reverter, limpa os campos de auditoria (volta ao estado "Marcado")
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.revert_checkin_with_audit(booking_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.class_bookings
  SET
    status         = 'Marcado',
    checkin_method = NULL,
    checkin_at     = NULL,
    checkin_by_id  = NULL
  WHERE id = booking_id_param;
END;
$$;

GRANT EXECUTE ON FUNCTION public.revert_checkin_with_audit(uuid) TO authenticated;


-- ==============================================================================
-- 6. ÍNDICE para performance dos códigos QR
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_daily_qr_codes_valid_date
  ON public.daily_qr_codes (valid_date DESC);


-- ==============================================================================
-- ✅ Verificação rápida (opcional — executar após migration)
-- ==============================================================================
-- SELECT public.get_or_create_daily_qr();  -- Deve retornar um UUID

-- Ver auditoria de check-ins de hoje:
-- SELECT cb.checkin_method, cb.checkin_at, cb.checkin_by_id,
--        p.full_name AS atleta, c.title AS aula
-- FROM class_bookings cb
-- JOIN profiles p ON p.id = cb.user_id
-- JOIN classes c ON c.id = cb.class_id
-- WHERE c.date = CURRENT_DATE AND cb.status = 'Presente'
-- ORDER BY cb.checkin_at DESC;
