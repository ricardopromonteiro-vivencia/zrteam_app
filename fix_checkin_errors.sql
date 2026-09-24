-- ==============================================================================
-- 🐛 FIX DE DOIS ERROS NO CHECK-IN QR
-- 1. Corrige o problema do fuso horário (TIME ZONE) na janela de check-in (erro: "Falha no Check-in").
-- 2. Corrige o bloqueio de incremento de aulas imposto pelo trigger de segurança (erro: "Não podes manipular o teu próprio contador").
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- PARTE 1: ATUALIZAÇÃO DO TRIGGER DE PROTEÇÃO DE PERFIL
-- Permite que processos de sistema/check-in alterem o contador 'attended_classes' 
-- quando explicitamente autorizado via variável de sessão 'app.bypass_profile_trigger'.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_protect_profile_fields_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
BEGIN
    -- 1. Triggers internos sem contexto de auth
    IF v_caller_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Obter papel do chamador
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    -- 3. ADMIN tem permissão total
    IF v_caller_role = 'Admin' THEN
        RETURN NEW;
    END IF;

    -- 4. REGRA: Apenas Admins podem mudar o ROLE
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Não tens permissão para alterar o papel (role). Esta ação requer privilégios de Administrador.';
    END IF;

    -- 5. Se estiver a atualizar o PRÓPRIO perfil
    IF OLD.id = v_caller_id THEN
        -- Se estiver a tentar atualizar as aulas, verificamos se tem permissão (variável de sistema)
        IF NEW.attended_classes IS DISTINCT FROM OLD.attended_classes THEN
            IF current_setting('app.bypass_profile_trigger', true) IS DISTINCT FROM 'true' THEN
                RAISE EXCEPTION 'Não podes manipular o teu próprio contador de aulas.';
            END IF;
        END IF;

        IF NEW.is_global_professor IS DISTINCT FROM OLD.is_global_professor THEN
            RAISE EXCEPTION 'Permissão negada para alterar o estatuto global.';
        END IF;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived OR 
           NEW.needs_validation IS DISTINCT FROM OLD.needs_validation OR
           NEW.is_hidden IS DISTINCT FROM OLD.is_hidden THEN
            RAISE EXCEPTION 'Não podes alterar o teu estado administrativo.';
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------------------------
-- PARTE 2: ATUALIZAÇÃO DA FUNÇÃO QUE INCREMENTA AS AULAS
-- Autoriza explicitamente a alteração do 'attended_classes' ignorando o erro do trigger.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.increment_attended_classes(user_id_param UUID)
RETURNS void AS $$
DECLARE
    v_athlete             record;
    v_classes_per_degree  int;
    v_total_for_next_belt int;
    v_next_belt           text;
    v_admin_prof          record;
    v_title               text;
    v_content             text;
BEGIN
    -- Permitir que o trigger de proteção do utilizador passe a atualização de aulas
    PERFORM set_config('app.bypass_profile_trigger', 'true', true);

    -- PASSO 1: Incrementar o contador
    UPDATE public.profiles
    SET attended_classes = attended_classes + 1
    WHERE id = user_id_param
    RETURNING id, full_name, role, belt, degrees, attended_classes, school_id
    INTO v_athlete;

    -- Restaurar proteção
    PERFORM set_config('app.bypass_profile_trigger', 'false', true);

    -- Só prossegue para notificações se for Atleta
    IF v_athlete.role != 'Atleta' THEN
        RETURN;
    END IF;

    -- PASSO 2: Determinar regras de graduação
    CASE v_athlete.belt
        WHEN 'Branco Kid'       THEN v_total_for_next_belt := 60;   v_classes_per_degree := 15;  v_next_belt := 'Cinza/ branco';
        WHEN 'Cinza/ branco'    THEN v_total_for_next_belt := 60;   v_classes_per_degree := 15;  v_next_belt := 'Cinza';
        WHEN 'Cinza'            THEN v_total_for_next_belt := 68;   v_classes_per_degree := 17;  v_next_belt := 'Cinza/ Preto';
        WHEN 'Cinza/ Preto'     THEN v_total_for_next_belt := 72;   v_classes_per_degree := 18;  v_next_belt := 'Amarelo / Branco';
        WHEN 'Amarelo / Branco' THEN v_total_for_next_belt := 60;   v_classes_per_degree := 15;  v_next_belt := 'Amarelo';
        WHEN 'Amarelo'          THEN v_total_for_next_belt := 68;   v_classes_per_degree := 17;  v_next_belt := 'Amarelo/ preto';
        WHEN 'Amarelo/ preto'   THEN v_total_for_next_belt := 72;   v_classes_per_degree := 18;  v_next_belt := 'Laranja/ Branco';
        WHEN 'Laranja/ Branco'  THEN v_total_for_next_belt := 60;   v_classes_per_degree := 15;  v_next_belt := 'Laranja';
        WHEN 'Laranja'          THEN v_total_for_next_belt := 68;   v_classes_per_degree := 17;  v_next_belt := 'Laranja/ preto';
        WHEN 'Laranja/ preto'   THEN v_total_for_next_belt := 72;   v_classes_per_degree := 18;  v_next_belt := 'Verde / Branco';
        WHEN 'Verde / Branco'   THEN v_total_for_next_belt := 60;   v_classes_per_degree := 15;  v_next_belt := 'Verde';
        WHEN 'Verde'            THEN v_total_for_next_belt := 68;   v_classes_per_degree := 17;  v_next_belt := 'Verde / Preto';
        WHEN 'Verde / Preto'    THEN v_total_for_next_belt := 72;   v_classes_per_degree := 18;  v_next_belt := 'Branco';
        WHEN 'Branco'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Azul';
        WHEN 'Azul'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Roxo';
        WHEN 'Roxo'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Marrom';
        WHEN 'Marrom'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Preto';
        WHEN 'Preto'   THEN v_total_for_next_belt := 1000; v_classes_per_degree := 200; v_next_belt := 'Preto';
        ELSE v_total_for_next_belt := 0; v_classes_per_degree := 0; v_next_belt := '';
    END CASE;

    IF v_classes_per_degree = 0 OR v_athlete.attended_classes <= 0 THEN
        RETURN;
    END IF;
    IF v_athlete.school_id IS NULL THEN
        RETURN;
    END IF;

    IF v_athlete.attended_classes = v_total_for_next_belt THEN
        v_title   := '🥋 Promoção de Faixa Pendente';
        v_content := 'O atleta ' || v_athlete.full_name || ' atingiu as ' || v_athlete.attended_classes || ' aulas e está elegível para receber a faixa ' || v_next_belt || '.';
    ELSIF v_athlete.attended_classes < v_total_for_next_belt AND v_athlete.attended_classes % v_classes_per_degree = 0 THEN
        v_title   := '🏅 Novo Grau Pendente';
        v_content := 'O atleta ' || v_athlete.full_name || ' (Faixa ' || v_athlete.belt || ') atingiu ' || v_athlete.attended_classes || ' aulas e está elegível para receber mais um grau.';
    END IF;

    IF v_title IS NOT NULL THEN
        BEGIN
            FOR v_admin_prof IN
                SELECT id FROM public.profiles WHERE role = 'Admin' OR (role IN ('Professor', 'Professor Responsável') AND school_id = v_athlete.school_id)
            LOOP
                INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
                VALUES (v_title, v_content, 'system', v_admin_prof.id, v_athlete.school_id, v_admin_prof.id);
            END LOOP;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING 'Falha notificação %', SQLERRM;
        END;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;


-- ------------------------------------------------------------------------------
-- PARTE 3: ATUALIZAÇÃO DO CHECK-IN AUTOMÁTICO (CORREÇÃO DE FUSO HORÁRIO)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.qr_self_checkin(qr_code_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_today date := (NOW() AT TIME ZONE 'Europe/Lisbon')::date;
  v_valid_code text;
  v_now timestamptz := NOW();
  v_booking_id uuid;
  v_class_title text;
  v_class_start text;
BEGIN
  IF v_user_id IS NULL THEN
    INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) VALUES (NULL, qr_code_param, 'not_authenticated');
    RETURN jsonb_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT code INTO v_valid_code FROM public.daily_qr_codes WHERE valid_date = v_today;

  IF v_valid_code IS NULL OR v_valid_code <> qr_code_param THEN
    INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) VALUES (v_user_id, qr_code_param, 'invalid_code');
    RETURN jsonb_build_object('success', false, 'reason', 'invalid_code');
  END IF;

  -- Janela de tempo avaliada na zona de Portugal para evitar atrasos/bloqueios do fuso horário da base de dados
  SELECT cb.id, c.title, c.start_time::text
  INTO v_booking_id, v_class_title, v_class_start
  FROM public.class_bookings cb
  JOIN public.classes c ON c.id = cb.class_id
  WHERE cb.user_id = v_user_id
    AND c.date = v_today
    AND cb.status = 'Marcado'
    AND ((c.date + c.start_time) AT TIME ZONE 'Europe/Lisbon' - interval '30 minutes') <= v_now
    AND ((c.date + c.end_time) AT TIME ZONE 'Europe/Lisbon' + interval '60 minutes') >= v_now
  ORDER BY c.start_time ASC
  LIMIT 1;

  IF v_booking_id IS NULL THEN
    INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) VALUES (v_user_id, qr_code_param, 'no_booking');
    RETURN jsonb_build_object('success', false, 'reason', 'no_booking');
  END IF;

  UPDATE public.class_bookings
  SET status = 'Presente', checkin_method = 'qr_self', checkin_at = v_now, checkin_by_id = NULL
  WHERE id = v_booking_id;

  PERFORM public.increment_attended_classes(v_user_id);

  INSERT INTO public.qr_checkin_logs (user_id, qr_code_scanned, status) VALUES (v_user_id, qr_code_param, 'success');

  RETURN jsonb_build_object('success', true, 'class_title', v_class_title, 'start_time', v_class_start);
END;
$$;
