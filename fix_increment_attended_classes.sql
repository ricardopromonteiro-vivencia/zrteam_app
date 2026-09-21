-- ==============================================================================
-- 🐛 FIX: increment_attended_classes — Aulas não contabilizadas
-- Data: 2026-07
--
-- CAUSA DO BUG:
--   Quando o atleta atinge um múltiplo de grau/faixa, a função tenta
--   inserir uma notificação em `announcements`. Se o atleta tiver
--   school_id = NULL (ou outro erro no INSERT), o PostgreSQL faz
--   ROLLBACK de TODA a transação — incluindo o UPDATE que incrementava
--   o contador attended_classes. Resultado: a aula é marcada como
--   "Presente" no booking mas o contador do atleta NÃO sobe.
--
-- SOLUÇÃO:
--   Separar o UPDATE do contador (bloco principal) das notificações
--   (bloco secundário com EXCEPTION handler próprio). Assim, mesmo que
--   a notificação falhe, o contador é sempre guardado.
-- ==============================================================================

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
    -- ─────────────────────────────────────────────────────────────────────
    -- PASSO 1: Incrementar o contador (SEMPRE deve acontecer)
    -- ─────────────────────────────────────────────────────────────────────
    UPDATE public.profiles
    SET attended_classes = attended_classes + 1
    WHERE id = user_id_param
    RETURNING id, full_name, role, belt, degrees, attended_classes, school_id
    INTO v_athlete;

    -- Só prossegue para notificações se for Atleta
    IF v_athlete.role != 'Atleta' THEN
        RETURN;
    END IF;

    -- ─────────────────────────────────────────────────────────────────────
    -- PASSO 2: Determinar regras de graduação
    -- ─────────────────────────────────────────────────────────────────────
    CASE v_athlete.belt
        -- Faixas Infantis / Juvenis
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
        -- Faixas Adultos
        WHEN 'Branco'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Azul';
        WHEN 'Azul'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Roxo';
        WHEN 'Roxo'    THEN v_total_for_next_belt := 300;  v_classes_per_degree := 75;  v_next_belt := 'Marrom';
        WHEN 'Marrom'  THEN v_total_for_next_belt := 288;  v_classes_per_degree := 72;  v_next_belt := 'Preto';
        WHEN 'Preto'   THEN v_total_for_next_belt := 1000; v_classes_per_degree := 200; v_next_belt := 'Preto';
        ELSE v_total_for_next_belt := 0; v_classes_per_degree := 0; v_next_belt := '';
    END CASE;

    -- ─────────────────────────────────────────────────────────────────────
    -- PASSO 3: Notificações de grau/faixa — bloco EXCEPTION independente
    --   Qualquer falha aqui NAO reverte o UPDATE do passo 1
    -- ─────────────────────────────────────────────────────────────────────

    -- Sem regras para esta faixa: não há nada a notificar
    IF v_classes_per_degree = 0 OR v_athlete.attended_classes <= 0 THEN
        RETURN;
    END IF;

    -- Sem escola atribuída: não há a quem notificar (atleta continua a ser contabilizado)
    IF v_athlete.school_id IS NULL THEN
        RETURN;
    END IF;

    -- Preparar mensagem consoante o tipo de marco atingido
    IF v_athlete.attended_classes = v_total_for_next_belt THEN
        v_title   := '🥋 Promoção de Faixa Pendente';
        v_content := 'O atleta ' || v_athlete.full_name ||
                     ' atingiu as ' || v_athlete.attended_classes ||
                     ' aulas e está elegível para receber a faixa ' || v_next_belt || '.';

    ELSIF v_athlete.attended_classes < v_total_for_next_belt
          AND v_athlete.attended_classes % v_classes_per_degree = 0 THEN
        v_title   := '🏅 Novo Grau Pendente';
        v_content := 'O atleta ' || v_athlete.full_name ||
                     ' (Faixa ' || v_athlete.belt || ') atingiu ' ||
                     v_athlete.attended_classes ||
                     ' aulas e está elegível para receber mais um grau.';
    END IF;

    -- Enviar notificações dentro de um sub-bloco com handler de erros próprio
    IF v_title IS NOT NULL THEN
        BEGIN
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
        EXCEPTION WHEN OTHERS THEN
            -- Notificação falhou mas o contador ja foi guardado — nao fazer rollback
            RAISE WARNING 'increment_attended_classes: falha ao inserir notificacao para atleta % (school_id: %): %',
                v_athlete.id, v_athlete.school_id, SQLERRM;
        END;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- FIX APLICADO
-- O contador attended_classes e sempre incrementado.
-- Falhas nas notificacoes de graduacao nao causam rollback.
-- Atletas sem school_id sao tratados graciosamente.
-- ==============================================================================
