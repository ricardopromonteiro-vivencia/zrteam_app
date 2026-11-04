-- ==============================================================================
-- 🥋 ZR TEAM — SUPORTE PARA MÚLTIPLOS ATLETAS POR CONTA (PAI / FILHOS)
-- ==============================================================================
-- Permite que um utilizador autenticado (ex: Pai/Mãe) possa associar e gerir
-- múltiplos atletas dependentes na mesma conta, sem necessidade de múltiplos
-- logins ou e-mails diferentes.
--
-- COMO APLICAR:
-- 1. Abre o Dashboard do Supabase.
-- 2. Vai ao SQL Editor.
-- 3. Cola e executa este script na totalidade.
-- ==============================================================================

-- 1. ADICIONAR COLUNA guardian_id À TABELA profiles
-- Se o atleta for um dependente, guardian_id aponta para o perfil do utilizador responsável (auth.uid).
-- Se for a conta principal, guardian_id é NULL.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS guardian_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_profiles_guardian_id ON public.profiles(guardian_id);

-- 2. REMOVER RESTRIÇÃO DE CHAVE ESTRANGEIRA (profiles_id_fkey)
-- Originalmente profiles.id tinha FK para auth.users(id).
-- Para atletas dependentes (sem email/password próprios), profiles.id é um novo UUID
-- e guardian_id referencia o perfil do utilizador autenticado.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- 3. ATUALIZAR POLÍTICAS RLS NA TABELA profiles
-- Permite que o utilizador autenticado selecione, insira e atualize os seus atletas dependentes.

DROP POLICY IF EXISTS "own_profile_select" ON public.profiles;
CREATE POLICY "own_profile_select"
ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR guardian_id = auth.uid());

DROP POLICY IF EXISTS "own_profile_write" ON public.profiles;
CREATE POLICY "own_profile_write"
ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR guardian_id = auth.uid());

DROP POLICY IF EXISTS "own_profile_insert" ON public.profiles;
CREATE POLICY "own_profile_insert"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (id = auth.uid() OR guardian_id = auth.uid());

-- 4. ATUALIZAR POLÍTICAS RLS NA TABELA class_bookings
-- Permite que o utilizador autenticado gira marcações (SELECT, INSERT, UPDATE, DELETE)
-- para si próprio E para qualquer atleta dependente associado à sua conta.

DROP POLICY IF EXISTS "cb_user_select_own" ON public.class_bookings;
CREATE POLICY "cb_user_select_own"
ON public.class_bookings FOR SELECT
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = class_bookings.user_id AND p.guardian_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cb_user_insert_own" ON public.class_bookings;
CREATE POLICY "cb_user_insert_own"
ON public.class_bookings FOR INSERT
WITH CHECK (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = class_bookings.user_id AND p.guardian_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cb_user_update_own" ON public.class_bookings;
CREATE POLICY "cb_user_update_own"
ON public.class_bookings FOR UPDATE
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = class_bookings.user_id AND p.guardian_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "cb_user_delete_own" ON public.class_bookings;
CREATE POLICY "cb_user_delete_own"
ON public.class_bookings FOR DELETE
USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = class_bookings.user_id AND p.guardian_id = auth.uid()
  )
);

-- 5. FUNÇÃO RPC: create_dependent_athlete
-- Cria de forma segura um atleta dependente associado ao utilizador autenticado.
-- O atleta é criado obrigatoriamente com needs_validation = true (pendente de aprovação).
CREATE OR REPLACE FUNCTION public.create_dependent_athlete(
  p_full_name text,
  p_school_id uuid,
  p_date_of_birth date,
  p_belt text,
  p_degrees integer,
  p_assigned_professor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_parent_id uuid := auth.uid();
  v_new_id uuid;
  v_existing_id uuid;
  v_school_exists boolean;
  v_prof_exists boolean;
BEGIN
  -- 1. Validação de autenticação
  IF v_parent_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Utilizador não autenticado.');
  END IF;

  -- 2. Validações de campos obrigatórios
  IF trim(coalesce(p_full_name, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'O nome completo é obrigatório.');
  END IF;

  IF p_school_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A escola é obrigatória.');
  END IF;

  IF p_date_of_birth IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A data de nascimento é obrigatória.');
  END IF;

  IF trim(coalesce(p_belt, '')) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'A faixa é obrigatória.');
  END IF;

  IF p_degrees IS NULL OR p_degrees < 0 OR p_degrees > 4 THEN
    RETURN jsonb_build_object('success', false, 'error', 'O grau deve estar entre 0 e 4.');
  END IF;

  IF p_assigned_professor_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'O professor é obrigatório.');
  END IF;

  -- 3. Validar se a escola e professor existem
  SELECT EXISTS(SELECT 1 FROM public.schools WHERE id = p_school_id) INTO v_school_exists;
  IF NOT v_school_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Escola selecionada inválida.');
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE id = p_assigned_professor_id 
      AND role IN ('Professor', 'Professor Responsável', 'Admin')
  ) INTO v_prof_exists;
  IF NOT v_prof_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Professor selecionado inválido.');
  END IF;

  -- 4. Prevenção de duplicados (Nome + Data de Nascimento)
  SELECT id INTO v_existing_id
  FROM public.profiles
  WHERE lower(trim(full_name)) = lower(trim(p_full_name))
    AND date_of_birth = p_date_of_birth;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Já existe um atleta registado com este nome e data de nascimento.');
  END IF;

  -- 5. Inserir atleta dependente
  v_new_id := gen_random_uuid();

  INSERT INTO public.profiles (
    id,
    guardian_id,
    full_name,
    role,
    belt,
    degrees,
    school_id,
    date_of_birth,
    assigned_professor_id,
    needs_validation,
    attended_classes,
    is_archived,
    created_at
  ) VALUES (
    v_new_id,
    v_parent_id,
    trim(p_full_name),
    'Atleta',
    p_belt,
    p_degrees,
    p_school_id,
    p_date_of_birth,
    p_assigned_professor_id,
    true, -- Fica obrigatoriamente a aguardar aprovação pelo professor/admin
    0,
    false,
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'id', v_new_id,
    'message', 'Atleta criado com sucesso! Fica a aguardar aprovação pelo professor ou administrador.'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_dependent_athlete TO authenticated;

-- 6. ATUALIZAR FUNÇÃO RPC: qr_self_checkin
-- Suporta parâmetro opcional athlete_id_param para permitir check-in do atleta atualmente comutado
CREATE OR REPLACE FUNCTION public.qr_self_checkin(
  qr_code_param text,
  athlete_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_target_user_id uuid;
  v_today date := (NOW() AT TIME ZONE 'Europe/Lisbon')::date;
  v_valid_code text;
  v_now timestamptz := NOW();
  v_booking_id uuid;
  v_class_title text;
  v_class_start text;
  v_is_authorized boolean := false;
  v_is_approved boolean := false;
BEGIN
  -- Segurança: só utilizadores autenticados podem chamar
  IF v_caller_id IS NULL THEN
    INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) 
    VALUES (NULL, qr_code_param, 'not_authenticated');
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  -- Definir e verificar quem é o atleta alvo
  IF athlete_id_param IS NOT NULL AND athlete_id_param <> v_caller_id THEN
    -- Verificar se o atleta alvo é dependente deste utilizador (guardian_id = caller)
    SELECT EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = athlete_id_param AND guardian_id = v_caller_id
    ) INTO v_is_authorized;

    IF NOT v_is_authorized THEN
      INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) 
      VALUES (v_caller_id, qr_code_param, 'unauthorized_athlete');
      RETURN jsonb_build_object('success', false, 'reason', 'unauthorized_athlete');
    END IF;

    v_target_user_id := athlete_id_param;
  ELSE
    v_target_user_id := v_caller_id;
  END IF;

  -- Verificar se o atleta alvo está aprovado (needs_validation = false)
  SELECT NOT coalesce(needs_validation, false) INTO v_is_approved
  FROM public.profiles
  WHERE id = v_target_user_id;

  IF NOT v_is_approved THEN
    RETURN jsonb_build_object('success', false, 'reason', 'athlete_needs_validation');
  END IF;

  -- 1. Verificar se o código QR é válido para hoje
  SELECT code INTO v_valid_code
  FROM public.daily_qr_codes
  WHERE valid_date = v_today;

  IF v_valid_code IS NULL OR v_valid_code <> qr_code_param THEN
    INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) 
    VALUES (v_target_user_id, qr_code_param, 'invalid_code');
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  -- 2. Encontrar a primeira marcação elegível (por janela horária)
  --    Janela: 30 minutos antes do início até 60 minutos após o fim
  SELECT cb.id, c.title, c.start_time::text
  INTO v_booking_id, v_class_title, v_class_start
  FROM public.class_bookings cb
  JOIN public.classes c ON c.id = cb.class_id
  WHERE cb.user_id = v_target_user_id
    AND c.date = v_today
    AND cb.status = 'Marcado'  -- Só marcações ainda por confirmar
    AND ((c.date + c.start_time) AT TIME ZONE 'Europe/Lisbon' - interval '30 minutes') <= v_now
    AND ((c.date + c.end_time) AT TIME ZONE 'Europe/Lisbon' + interval '60 minutes') >= v_now
  ORDER BY c.start_time ASC
  LIMIT 1;

  -- 3. Sem marcação válida na janela horária
  IF v_booking_id IS NULL THEN
    INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) 
    VALUES (v_target_user_id, qr_code_param, 'no_booking');
    RETURN jsonb_build_object('success', false, 'reason', 'no_booking');
  END IF;

  -- 4. Marcar como Presente + registar auditoria
  UPDATE public.class_bookings
  SET
    status         = 'Presente',
    checkin_method = 'qr_self',
    checkin_at     = v_now,
    checkin_by_id  = v_caller_id
  WHERE id = v_booking_id;

  -- 5. Incrementar contador de aulas assistidas
  PERFORM public.increment_attended_classes(v_target_user_id);

  -- 6. Registar log de sucesso
  INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) 
  VALUES (v_target_user_id, qr_code_param, 'success');

  RETURN jsonb_build_object(
    'success', true,
    'class_title', v_class_title,
    'start_time', v_class_start
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.qr_self_checkin(text, uuid) TO authenticated;

