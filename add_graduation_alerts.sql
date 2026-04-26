-- ==============================================================================
-- 🥋 AUTO PROMOTION NOTIFICATIONS (MANUAL GRADUATIONS ONLY)
-- Redefine a função de incremento de aulas para garantir que avise os gestores
-- da escola (Admin e Prof Responsável) quando o atleta atingir aulas para mudar de grau ou faixa.
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
    -- 1. Incrementar as aulas do atleta (Sem promoções automáticas de dados)
    UPDATE public.profiles 
    SET attended_classes = attended_classes + 1 
    WHERE id = user_id_param
    RETURNING id, full_name, role, belt, degrees, attended_classes, school_id INTO v_athlete;

    -- 2. Validar que o registo pertence a um atleta
    IF v_athlete.role != 'Atleta' THEN
        RETURN;
    END IF;

    -- 3. Mapear regras de graduação com base na faixa atual do atleta
    CASE v_athlete.belt
        WHEN 'Cinza/ branco' THEN v_total_for_next_belt := 40; v_classes_per_degree := 8; v_next_belt := 'Cinza';
        WHEN 'Cinza' THEN v_total_for_next_belt := 40; v_classes_per_degree := 8; v_next_belt := 'Cinza/ Preto';
        WHEN 'Cinza/ Preto' THEN v_total_for_next_belt := 40; v_classes_per_degree := 8; v_next_belt := 'Amarelo / Branco';
        WHEN 'Amarelo / Branco' THEN v_total_for_next_belt := 50; v_classes_per_degree := 10; v_next_belt := 'Amarelo';
        WHEN 'Amarelo' THEN v_total_for_next_belt := 50; v_classes_per_degree := 10; v_next_belt := 'Amarelo/ preto';
        WHEN 'Amarelo/ preto' THEN v_total_for_next_belt := 50; v_classes_per_degree := 10; v_next_belt := 'Laranja/ Branco';
        WHEN 'Laranja/ Branco' THEN v_total_for_next_belt := 60; v_classes_per_degree := 12; v_next_belt := 'Laranja';
        WHEN 'Laranja' THEN v_total_for_next_belt := 60; v_classes_per_degree := 12; v_next_belt := 'Laranja/ preto';
        WHEN 'Laranja/ preto' THEN v_total_for_next_belt := 60; v_classes_per_degree := 12; v_next_belt := 'Verde / Branco';
        WHEN 'Verde / Branco' THEN v_total_for_next_belt := 70; v_classes_per_degree := 14; v_next_belt := 'Verde';
        WHEN 'Verde' THEN v_total_for_next_belt := 70; v_classes_per_degree := 14; v_next_belt := 'Verde / Preto';
        WHEN 'Verde / Preto' THEN v_total_for_next_belt := 70; v_classes_per_degree := 14; v_next_belt := 'Branco';
        WHEN 'Branco' THEN v_total_for_next_belt := 220; v_classes_per_degree := 55; v_next_belt := 'Azul';
        WHEN 'Azul' THEN v_total_for_next_belt := 300; v_classes_per_degree := 75; v_next_belt := 'Roxo';
        WHEN 'Roxo' THEN v_total_for_next_belt := 300; v_classes_per_degree := 75; v_next_belt := 'Marrom';
        WHEN 'Marrom' THEN v_total_for_next_belt := 280; v_classes_per_degree := 70; v_next_belt := 'Preto';
        WHEN 'Preto' THEN v_total_for_next_belt := 1000; v_classes_per_degree := 200; v_next_belt := 'Preto';
        ELSE v_total_for_next_belt := 0; v_classes_per_degree := 0; v_next_belt := '';
    END CASE;

    -- 4. Verificar se o número de aulas atual despoleta algum aviso de grau ou faixa
    IF v_classes_per_degree > 0 AND v_athlete.attended_classes > 0 THEN
        IF v_athlete.attended_classes = v_total_for_next_belt THEN
            v_title := '🥋 Promoção de Faixa Pendente';
            v_content := 'O atleta ' || v_athlete.full_name || ' atingiu as ' || v_athlete.attended_classes || ' aulas e está elegível para receber a faixa ' || v_next_belt || '.';
        ELSIF v_athlete.attended_classes < v_total_for_next_belt AND v_athlete.attended_classes % v_classes_per_degree = 0 THEN
            v_title := '🏅 Novo Grau Pendente';
            v_content := 'O atleta ' || v_athlete.full_name || ' (Faixa ' || v_athlete.belt || ') atingiu ' || v_athlete.attended_classes || ' aulas e está elegível para receber mais um grau.';
        END IF;

        -- 5. Se houver aviso, notificar os gestores (Admin e Prof Responsável)
        IF v_title IS NOT NULL THEN
            FOR v_admin_prof IN 
                SELECT id FROM public.profiles 
                WHERE role = 'Admin' 
                   OR (role = 'Professor Responsável' AND school_id = v_athlete.school_id)
            LOOP
                -- Cria um aviso privado (system) direcionado ao gestor
                -- Isto vai também despoletar a notificação push devido ao trigger `notify_push_on_announcement`
                INSERT INTO public.announcements (
                    title, content, type, author_id, school_id, target_user_id
                ) VALUES (
                    v_title, 
                    v_content, 
                    'system', 
                    v_admin_prof.id,   -- Usamos o ID do gestor como autor por segurança de FK
                    v_athlete.school_id, 
                    v_admin_prof.id    -- Alvo é o próprio gestor
                );
            END LOOP;
        END IF;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
