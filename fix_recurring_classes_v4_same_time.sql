-- ==============================================================================
-- 🥋 FIX v4 — AULAS RECORRENTES: MESMA ESCOLA, MESMA HORA, 2 AULAS DIFERENTES
-- Data: 2026-05-07
-- Problema: Quando existem 2 aulas recorrentes na mesma escola à mesma hora,
--           apenas a primeira é gerada. A segunda é ignorada porque a verificação
--           de duplicado usa (date, start_time, school_id) como chave — o que
--           é demasiado genérico e confunde as 2 aulas como sendo a mesma.
--
-- Solução: A chave de verificação passa a incluir professor_id, porque o que
--          distingue 2 aulas diferentes na mesma escola/horário é o professor.
--          Adicionalmente, usa template_class_id (quando disponível) como
--          verificação primária — é a forma mais precisa de detetar duplicados.
-- ==============================================================================


-- ==============================================================================
-- DIAGNÓSTICO (corre primeiro para confirmar o cenário)
-- Mostra aulas recorrentes na mesma escola à mesma hora no mesmo dia
-- ==============================================================================

/*
SELECT
    c.date,
    c.start_time,
    s.name AS escola,
    COUNT(*) AS total_aulas,
    array_agg(c.title ORDER BY c.title) AS titulos,
    array_agg(p.full_name ORDER BY c.title) AS professores
FROM public.classes c
JOIN public.schools s ON s.id = c.school_id
JOIN public.profiles p ON p.id = c.professor_id
WHERE c.is_recurring = true
GROUP BY c.date, c.start_time, c.school_id, s.name
HAVING COUNT(*) > 1
ORDER BY c.date DESC, c.start_time;
*/


-- ==============================================================================
-- PASSO 1: CORRIGIR A FUNÇÃO process_recurring_classes()
-- Mudança principal: a verificação de duplicado passa a usar professor_id
-- como discriminador adicional — o que distingue 2 aulas na mesma escola/hora.
--
-- Lógica de verificação (duas camadas):
--   1ª (mais precisa):   template_class_id = v_class.id AND date = v_next_date
--      → Sabe exactamente que esta aula já foi gerada a partir desta template
--   2ª (fallback):       (date, start_time, school_id, professor_id) já existe
--      → Para aulas sem template_class_id (criadas manualmente ou antes do v3)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.process_recurring_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class       record;
    v_next_date   date;
    v_exists      boolean;
    v_today       date;
    v_yesterday   date;
    v_created_by  UUID;
    v_count_processed INT := 0;
    v_count_skipped   INT := 0;
    v_count_created   INT := 0;
BEGIN
    -- Sempre em hora de Portugal para evitar bugs de "dia errado"
    v_today     := (NOW() AT TIME ZONE 'Europe/Lisbon')::date;
    v_yesterday := v_today - 1;

    RAISE LOG '[process_recurring_classes] ▶️ A correr. Hoje (Lisboa): %, Ontem: %',
        v_today, v_yesterday;

    FOR v_class IN
        SELECT * FROM public.classes
        WHERE is_recurring = true
          AND date = v_yesterday
    LOOP
        v_count_processed := v_count_processed + 1;
        v_next_date  := v_class.date + 7;
        v_created_by := COALESCE(v_class.created_by, v_class.professor_id);

        -- ======================================================================
        -- VERIFICAÇÃO DE DUPLICADO — CORRIGIDA (v4)
        --
        -- ANTES (bug): só usava (date, start_time, school_id)
        --   → Confundia 2 aulas diferentes na mesma escola à mesma hora
        --
        -- AGORA (fix): usa duas verificações em OR:
        --   1. template_class_id = v_class.id  (verificação precisa — melhor)
        --   2. (date, start_time, school_id, professor_id)  (fallback seguro)
        --
        -- O professor_id é o discriminador correcto: um professor não pode
        -- estar em dois sítios ao mesmo tempo, portanto 2 aulas na mesma
        -- escola/hora COM professores diferentes são AULAS DISTINTAS.
        -- ======================================================================
        SELECT EXISTS (
            SELECT 1 FROM public.classes
            WHERE date = v_next_date
              AND (
                  -- Verificação 1 (precisa): esta aula já foi gerada como filha desta
                  template_class_id = v_class.id

                  OR

                  -- Verificação 2 (fallback): mesmo horário, mesma escola, mesmo professor
                  (
                      start_time   = v_class.start_time
                      AND professor_id = v_class.professor_id
                      AND (
                          (school_id = v_class.school_id)
                          OR (school_id IS NULL AND v_class.school_id IS NULL)
                      )
                  )
              )
        ) INTO v_exists;

        IF v_exists THEN
            v_count_skipped := v_count_skipped + 1;
            RAISE LOG '[process_recurring_classes] ⏭️ Já existe aula "%s" para % às % (escola: %, prof: %). A saltar.',
                v_class.title, v_next_date, v_class.start_time,
                v_class.school_id, v_class.professor_id;
        ELSE
            INSERT INTO public.classes (
                title,
                date,
                start_time,
                end_time,
                capacity,
                professor_id,
                school_id,
                is_recurring,
                second_professor_id,
                created_by,
                template_class_id   -- rastreio da aula-mãe (requer coluna do v3)
            ) VALUES (
                v_class.title,
                v_next_date,
                v_class.start_time,
                v_class.end_time,
                v_class.capacity,
                v_class.professor_id,
                v_class.school_id,
                true,
                v_class.second_professor_id,
                v_created_by,
                v_class.id  -- ID da aula que gerou esta
            );

            v_count_created := v_count_created + 1;
            RAISE LOG '[process_recurring_classes] ✅ Criada "%s" para % às % (escola: %, prof: %).',
                v_class.title, v_next_date, v_class.start_time,
                v_class.school_id, v_class.professor_id;
        END IF;
    END LOOP;

    RAISE LOG '[process_recurring_classes] ✅ Concluído. Processadas: %, Criadas: %, Saltadas: %',
        v_count_processed, v_count_created, v_count_skipped;
END;
$$;


-- ==============================================================================
-- PASSO 2: VERIFICAR SE A COLUNA template_class_id JÁ EXISTE
-- (foi criada no script v3; se ainda não existir, cria aqui)
-- ==============================================================================
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS template_class_id UUID
    REFERENCES public.classes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.classes.template_class_id IS
    'ID da aula-mãe que gerou esta ocorrência via cron. NULL = criada manualmente.';


-- ==============================================================================
-- PASSO 3: CONFIRMAR A FUNÇÃO FOI ATUALIZADA
-- ==============================================================================
SELECT
    proname AS funcao,
    prosrc LIKE '%professor_id = v_class.professor_id%' AS tem_fix_v4
FROM pg_proc
WHERE proname = 'process_recurring_classes'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- Deve devolver: tem_fix_v4 = true


-- ==============================================================================
-- PASSO 4 (OPCIONAL): TESTAR A FUNÇÃO MANUALMENTE
-- Só usar em ambiente de teste ou quando tens a certeza de que ontem havia
-- aulas recorrentes. ATENÇÃO: vai criar as aulas da semana seguinte!
-- ==============================================================================
-- SELECT public.process_recurring_classes();


-- ==============================================================================
-- PASSO 5: DIAGNÓSTICO PÓS-EXECUÇÃO
-- Confirma que não há aulas da semana próxima em falta
-- (Corre depois de executar a função ou depois do próximo cron)
-- ==============================================================================
/*
-- Ver todas as aulas recorrentes geradas para os próximos 7 dias:
SELECT
    c.date,
    c.start_time,
    c.end_time,
    c.title,
    s.name AS escola,
    p.full_name AS professor,
    c.template_class_id IS NOT NULL AS gerada_por_cron
FROM public.classes c
LEFT JOIN public.schools s ON s.id = c.school_id
LEFT JOIN public.profiles p ON p.id = c.professor_id
WHERE c.is_recurring = true
  AND c.date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7
ORDER BY c.date, c.school_id, c.start_time;
*/


-- ==============================================================================
-- RESUMO DA CORREÇÃO:
--
-- ANTES (bug):
--   Verificação de duplicado: WHERE date = X AND start_time = Y AND school_id = Z
--   → 2 aulas diferentes (prof. A e prof. B) na mesma escola à mesma hora
--     são vistas como a mesma → a segunda é sempre ignorada ❌
--
-- DEPOIS (fix v4):
--   Verificação de duplicado: (template_class_id = THIS_CLASS_ID)
--                          OR (date, start_time, school_id, professor_id)
--   → Cada aula é verificada individualmente pelo seu professor
--   → Se prof. A e prof. B dão aula à mesma hora na mesma escola,
--     ambas são geradas correctamente ✅
-- ==============================================================================
