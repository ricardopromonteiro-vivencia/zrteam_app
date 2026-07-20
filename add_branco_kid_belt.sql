-- ==============================================================================
-- 🥋 NOVA FAIXA: Branco Kid (1ª faixa Infantis/Juvenis)
-- Atualiza a função increment_attended_classes com a nova faixa
-- Corre no SQL Editor do Supabase
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

    -- Regras de graduação (incluindo nova faixa Branco Kid)
    CASE v_athlete.belt
        -- ── Faixas Infantis / Juvenis ──
        WHEN 'Branco Kid'       THEN v_total_for_next_belt := 60;  v_classes_per_degree := 15; v_next_belt := 'Cinza/ branco';
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
        -- ── Faixas Adultos ──
        WHEN 'Branco'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Azul';
        WHEN 'Azul'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Roxo';
        WHEN 'Roxo'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Marrom';
        WHEN 'Marrom'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Preto';
        WHEN 'Preto'   THEN v_total_for_next_belt := 1000; v_classes_per_degree := 200; v_next_belt := 'Preto';
        ELSE v_total_for_next_belt := 0; v_classes_per_degree := 0; v_next_belt := '';
    END CASE;

    IF v_classes_per_degree > 0 AND v_athlete.attended_classes > 0 THEN
        -- Aviso de faixa: exatamente ao atingir o total
        IF v_athlete.attended_classes = v_total_for_next_belt THEN
            v_title   := '🥋 Promoção de Faixa Pendente';
            v_content := 'O atleta ' || v_athlete.full_name ||
                         ' atingiu as ' || v_athlete.attended_classes ||
                         ' aulas e está elegível para receber a faixa ' || v_next_belt || '.';

        -- Aviso de grau: múltiplo de classesPerDegree, antes do total da faixa
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
-- ✅ Faixa "Branco Kid" adicionada à função de incremento de aulas
-- ==============================================================================
