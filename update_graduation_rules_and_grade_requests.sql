-- ==============================================================================
-- 🥋 MIGRAÇÃO: Pedidos de Mudança de Grau/Faixa + Novas Regras de Graduação
-- Corre este script no SQL Editor do Supabase
-- Data: 2026-07
-- ==============================================================================

-- ==============================================================================
-- PARTE 1: Tabela de pedidos de mudança de grau/faixa
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.grade_change_requests (
  id            uuid        NOT NULL DEFAULT gen_random_uuid(),
  athlete_id    uuid        NOT NULL,
  requested_belt    text    NOT NULL,
  requested_degrees integer NOT NULL CHECK (requested_degrees >= 0 AND requested_degrees <= 4),
  current_belt  text        NOT NULL,
  current_degrees integer   NOT NULL,
  status        text        NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  reviewed_by   uuid,
  reviewed_at   timestamptz,
  notes         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT grade_change_requests_pkey PRIMARY KEY (id),
  CONSTRAINT gcr_athlete_id_fkey   FOREIGN KEY (athlete_id)  REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT gcr_reviewed_by_fkey  FOREIGN KEY (reviewed_by) REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_gcr_athlete_id ON public.grade_change_requests(athlete_id);
CREATE INDEX IF NOT EXISTS idx_gcr_status     ON public.grade_change_requests(status);

-- RLS
ALTER TABLE public.grade_change_requests ENABLE ROW LEVEL SECURITY;

-- Atleta cria pedidos para si próprio
CREATE POLICY "Atleta cria pedido de grau"
  ON public.grade_change_requests FOR INSERT
  TO authenticated
  WITH CHECK (athlete_id = auth.uid());

-- Atleta vê os seus próprios pedidos
CREATE POLICY "Atleta ve os seus pedidos"
  ON public.grade_change_requests FOR SELECT
  TO authenticated
  USING (athlete_id = auth.uid());

-- Admin vê e gere todos os pedidos
CREATE POLICY "Admin gere todos os pedidos de grau"
  ON public.grade_change_requests FOR ALL
  USING (public.get_auth_role() = 'Admin');

-- Professor/Prof. Responsável vê e gere pedidos da sua escola
CREATE POLICY "Professor gere pedidos da sua escola"
  ON public.grade_change_requests FOR ALL
  USING (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = grade_change_requests.athlete_id
        AND p.school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- ==============================================================================
-- PARTE 2: Função para aprovar pedido de mudança de grau/faixa
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.approve_grade_change(
  request_id_param  uuid,
  notes_param       text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_request  record;
  v_reviewer record;
BEGIN
  -- Verificar quem está a aprovar
  SELECT id, role, school_id INTO v_reviewer
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_reviewer.role NOT IN ('Admin', 'Professor', 'Professor Responsável') THEN
    RAISE EXCEPTION 'Sem permissão para aprovar pedidos de graduação.';
  END IF;

  -- Buscar o pedido
  SELECT * INTO v_request
  FROM public.grade_change_requests
  WHERE id = request_id_param AND status = 'pendente';

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado.';
  END IF;

  -- Verificar que professor só aprova da sua escola
  IF v_reviewer.role != 'Admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_request.athlete_id AND school_id = v_reviewer.school_id
    ) THEN
      RAISE EXCEPTION 'Sem permissão para aprovar pedidos de outras escolas.';
    END IF;
  END IF;

  -- Atualizar o perfil do atleta
  UPDATE public.profiles
  SET
    belt    = v_request.requested_belt,
    degrees = v_request.requested_degrees
  WHERE id = v_request.athlete_id;

  -- Marcar pedido como aprovado
  UPDATE public.grade_change_requests
  SET
    status      = 'aprovado',
    reviewed_by = v_reviewer.id,
    reviewed_at = now(),
    notes       = notes_param
  WHERE id = request_id_param;

  -- Notificar o atleta via announcement
  INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
  SELECT
    '🥋 Graduação Aprovada!',
    'A tua mudança para Faixa ' || v_request.requested_belt ||
    ', ' || v_request.requested_degrees || '° Grau foi aprovada. Parabéns!',
    'system',
    v_reviewer.id,
    p.school_id,
    v_request.athlete_id
  FROM public.profiles p
  WHERE p.id = v_request.athlete_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- PARTE 3: Função para rejeitar pedido de mudança de grau/faixa
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reject_grade_change(
  request_id_param  uuid,
  notes_param       text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_request  record;
  v_reviewer record;
BEGIN
  SELECT id, role, school_id INTO v_reviewer
  FROM public.profiles
  WHERE id = auth.uid();

  IF v_reviewer.role NOT IN ('Admin', 'Professor', 'Professor Responsável') THEN
    RAISE EXCEPTION 'Sem permissão para rejeitar pedidos de graduação.';
  END IF;

  SELECT * INTO v_request
  FROM public.grade_change_requests
  WHERE id = request_id_param AND status = 'pendente';

  IF v_request IS NULL THEN
    RAISE EXCEPTION 'Pedido não encontrado ou já processado.';
  END IF;

  IF v_reviewer.role != 'Admin' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = v_request.athlete_id AND school_id = v_reviewer.school_id
    ) THEN
      RAISE EXCEPTION 'Sem permissão para rejeitar pedidos de outras escolas.';
    END IF;
  END IF;

  UPDATE public.grade_change_requests
  SET
    status      = 'rejeitado',
    reviewed_by = v_reviewer.id,
    reviewed_at = now(),
    notes       = notes_param
  WHERE id = request_id_param;

  -- Notificar o atleta
  INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
  SELECT
    '❌ Pedido de Graduação Não Aprovado',
    'O teu pedido de mudança para Faixa ' || v_request.requested_belt ||
    ', ' || v_request.requested_degrees || '° Grau não foi aprovado.' ||
    CASE WHEN notes_param IS NOT NULL AND notes_param != ''
         THEN ' Motivo: ' || notes_param ELSE '' END,
    'system',
    v_reviewer.id,
    p.school_id,
    v_request.athlete_id
  FROM public.profiles p
  WHERE p.id = v_request.athlete_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- PARTE 4: Trigger para notificar professor/admin quando atleta submete pedido
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.notify_grade_change_request()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_athlete   record;
  v_manager   record;
BEGIN
  IF NEW.status != 'pendente' THEN
    RETURN NEW;
  END IF;

  SELECT full_name, school_id INTO v_athlete
  FROM public.profiles
  WHERE id = NEW.athlete_id;

  FOR v_manager IN
    SELECT id FROM public.profiles
    WHERE role = 'Admin'
       OR (role IN ('Professor', 'Professor Responsável') AND school_id = v_athlete.school_id)
  LOOP
    INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
    VALUES (
      '🥋 Pedido de Graduação Pendente',
      'O atleta ' || v_athlete.full_name || ' pediu mudança para Faixa ' ||
      NEW.requested_belt || ', ' || NEW.requested_degrees || '° Grau. Valida em Graduações.',
      'system',
      NEW.athlete_id,
      v_athlete.school_id,
      v_manager.id
    );
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_grade_change_request ON public.grade_change_requests;
CREATE TRIGGER on_grade_change_request
  AFTER INSERT ON public.grade_change_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_grade_change_request();

-- ==============================================================================
-- PARTE 5: Função increment_attended_classes com NOVAS REGRAS (2026-07)
-- NUNCA BAIXA: apenas notifica, nunca altera belt/degrees automaticamente.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.increment_attended_classes(user_id_param UUID)
RETURNS void AS $$
DECLARE
    v_athlete record;
    v_classes_per_degree int;
    v_total_for_next_belt int;
    v_next_belt text;
    v_admin_prof record;
    v_title text;
    v_content text;
BEGIN
    UPDATE public.profiles
    SET attended_classes = attended_classes + 1
    WHERE id = user_id_param
    RETURNING id, full_name, role, belt, degrees, attended_classes, school_id INTO v_athlete;

    IF v_athlete.role != 'Atleta' THEN
        RETURN;
    END IF;

    -- Novas regras de graduação 2026-07
    CASE v_athlete.belt
        WHEN 'Cinza/ branco'    THEN v_total_for_next_belt := 60;  v_classes_per_degree := 15; v_next_belt := 'Cinza';
        WHEN 'Cinza'            THEN v_total_for_next_belt := 68;  v_classes_per_degree := 17; v_next_belt := 'Cinza/ Preto';
        WHEN 'Cinza/ Preto'     THEN v_total_for_next_belt := 72;  v_classes_per_degree := 18; v_next_belt := 'Amarelo / Branco';
        WHEN 'Amarelo / Branco' THEN v_total_for_next_belt := 60;  v_classes_per_degree := 15; v_next_belt := 'Amarelo';
        WHEN 'Amarelo'          THEN v_total_for_next_belt := 68;  v_classes_per_degree := 17; v_next_belt := 'Amarelo/ preto';
        WHEN 'Amarelo/ preto'   THEN v_total_for_next_belt := 72;  v_classes_per_degree := 18; v_next_belt := 'Laranja/ Branco';
        WHEN 'Laranja/ Branco'  THEN v_total_for_next_belt := 60;  v_classes_per_degree := 15; v_next_belt := 'Laranja';
        WHEN 'Laranja'          THEN v_total_for_next_belt := 68;  v_classes_per_degree := 17; v_next_belt := 'Laranja/ preto';
        WHEN 'Laranja/ preto'   THEN v_total_for_next_belt := 72;  v_classes_per_degree := 18; v_next_belt := 'Verde / Branco';
        WHEN 'Verde / Branco'   THEN v_total_for_next_belt := 60;  v_classes_per_degree := 15; v_next_belt := 'Verde';
        WHEN 'Verde'            THEN v_total_for_next_belt := 68;  v_classes_per_degree := 17; v_next_belt := 'Verde / Preto';
        WHEN 'Verde / Preto'    THEN v_total_for_next_belt := 72;  v_classes_per_degree := 18; v_next_belt := 'Branco';
        WHEN 'Branco'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Azul';
        WHEN 'Azul'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Roxo';
        WHEN 'Roxo'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Marrom';
        WHEN 'Marrom'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Preto';
        WHEN 'Preto'   THEN v_total_for_next_belt := 1000; v_classes_per_degree := 200; v_next_belt := 'Preto';
        ELSE v_total_for_next_belt := 0; v_classes_per_degree := 0; v_next_belt := '';
    END CASE;

    IF v_classes_per_degree > 0 AND v_athlete.attended_classes > 0 THEN
        -- Aviso de faixa: apenas quando atinge EXATAMENTE o total
        IF v_athlete.attended_classes = v_total_for_next_belt THEN
            v_title   := '🥋 Promoção de Faixa Pendente';
            v_content := 'O atleta ' || v_athlete.full_name ||
                         ' atingiu as ' || v_athlete.attended_classes ||
                         ' aulas e está elegível para receber a faixa ' || v_next_belt || '.';

        -- Aviso de grau: múltiplo de classesPerDegree, antes de atingir total
        ELSIF v_athlete.attended_classes < v_total_for_next_belt
              AND v_athlete.attended_classes % v_classes_per_degree = 0 THEN
            v_title   := '🏅 Novo Grau Pendente';
            v_content := 'O atleta ' || v_athlete.full_name ||
                         ' (Faixa ' || v_athlete.belt || ') atingiu ' ||
                         v_athlete.attended_classes ||
                         ' aulas e está elegível para receber mais um grau.';
        END IF;

        IF v_title IS NOT NULL THEN
            FOR v_admin_prof IN
                SELECT id FROM public.profiles
                WHERE role = 'Admin'
                   OR (role IN ('Professor', 'Professor Responsável')
                       AND school_id = v_athlete.school_id)
            LOOP
                INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
                VALUES (
                    v_title, v_content, 'system',
                    v_admin_prof.id, v_athlete.school_id, v_admin_prof.id
                );
            END LOOP;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- FIM DA MIGRAÇÃO ✅
-- ==============================================================================
