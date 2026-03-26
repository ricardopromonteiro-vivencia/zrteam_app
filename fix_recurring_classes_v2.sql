-- ==============================================================================
-- 🥋 ZR TEAM APP — CORREÇÃO v2: AULAS RECORRENTES SEM CASCATA
-- Problema da versão anterior: a janela de 7 dias fazia com que cada aula
-- criada pelo cron entrasse na janela do dia seguinte e gerasse mais uma aula,
-- criando um efeito cascata indefinido.
--
-- Solução: o cron corre diariamente (01:00 AM). A função só olha para aulas
-- de EXATAMENTE ontem (CURRENT_DATE - 1). Assim cada aula original gera
-- apenas 1 cópia, para daqui a exatamente 7 dias (+ 6 dias a partir de amanhã).
-- A aula filha, quando chegar a "ontem", gerará a próxima semana, e assim
-- sucessivamente — sem cascata, apenas 1 semana de antecedência de cada vez.
-- ==============================================================================

-- 1. Recriar a função corrigida
CREATE OR REPLACE FUNCTION public.process_recurring_classes()
RETURNS void AS $$
DECLARE
  v_class record;
  v_next_date date;
  v_exists boolean;
BEGIN
  -- IMPORTANTE: só processa aulas de ONTEM (CURRENT_DATE - 1).
  -- Isto garante que:
  --   a) Cada aula só é processada UMA vez (no dia seguinte à sua ocorrência).
  --   b) Não há cascata: a aula criada para a próxima semana só será
  --      processada daqui a 7 dias (quando for "ontem" novamente).
  FOR v_class IN
    SELECT * FROM public.classes
    WHERE is_recurring = true
      AND date = (CURRENT_DATE - INTERVAL '1 day')::date
  LOOP
    -- Data da próxima ocorrência: exatamente 7 dias depois
    v_next_date := v_class.date + INTERVAL '7 days';

    -- Verificar se já existe aula com o mesmo título, escola, data e hora
    SELECT EXISTS (
      SELECT 1 FROM public.classes
      WHERE title       = v_class.title
        AND date        = v_next_date
        AND start_time  = v_class.start_time
        AND (
          (school_id    = v_class.school_id)
          OR (school_id IS NULL AND v_class.school_id IS NULL)
        )
    ) INTO v_exists;

    -- Criar a aula da próxima semana apenas se não existir
    IF NOT v_exists THEN
      INSERT INTO public.classes (
        title,
        date,
        start_time,
        end_time,
        capacity,
        professor_id,
        school_id,
        is_recurring,
        second_professor_id
      ) VALUES (
        v_class.title,
        v_next_date,
        v_class.start_time,
        v_class.end_time,
        v_class.capacity,
        v_class.professor_id,
        v_class.school_id,
        true,                        -- A aula filha também é recorrente
        v_class.second_professor_id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Reagendar o cron job (substitui o anterior pelo mesmo nome)
SELECT cron.schedule(
  'daily_recurring_classes_process',
  '0 1 * * *',   -- 01:00 AM todos os dias
  $$SELECT public.process_recurring_classes()$$
);

-- ==============================================================================
-- APÓS CORRER ESTE SCRIPT, VERIFICA SE EXISTEM DUPLICADOS COM:
--
-- SELECT title, date, start_time, school_id, COUNT(*) as total
-- FROM public.classes
-- GROUP BY title, date, start_time, school_id
-- HAVING COUNT(*) > 1
-- ORDER BY date DESC;
--
-- Se houver duplicados, podes eliminá-los com (CUIDADO: elimina a cópia mais recente):
--
-- DELETE FROM public.classes
-- WHERE id IN (
--   SELECT id FROM (
--     SELECT id,
--            ROW_NUMBER() OVER (
--              PARTITION BY title, date, start_time, school_id
--              ORDER BY created_at ASC
--            ) AS rn
--     FROM public.classes
--   ) ranked
--   WHERE rn > 1
-- );
-- ==============================================================================
