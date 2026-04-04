-- ==============================================================================
-- 🥋 RESOLUÇÃO DE DUPLICADOS E 'CREATED_BY' EM AULAS RECORRENTES
-- ==============================================================================

-- 1. Substituir a Função do Cron: Agora herda o `created_by` da aula original!
CREATE OR REPLACE FUNCTION public.process_recurring_classes()
RETURNS void AS $$
DECLARE
  v_class record;
  v_next_date date;
  v_exists boolean;
BEGIN
  -- Só processa aulas que aconteceram EXATAMENTE ONTEM
  FOR v_class IN
    SELECT * FROM public.classes
    WHERE is_recurring = true
      AND date = (CURRENT_DATE - INTERVAL '1 day')::date
  LOOP
    -- 7 dias depois (mesmo dia da semana)
    v_next_date := v_class.date + INTERVAL '7 days';

    SELECT EXISTS (
      SELECT 1 FROM public.classes
      WHERE title       = v_class.title
        AND date        = v_next_date
        AND start_time  = v_class.start_time
        AND (school_id  = v_class.school_id OR (school_id IS NULL AND v_class.school_id IS NULL))
    ) INTO v_exists;

    -- Se não existir, avança com a criação preservando TUDO (incluindo created_by)
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
        second_professor_id,
        created_by
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
        v_class.created_by
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Re-agendar para garantir
SELECT cron.schedule(
  'daily_recurring_classes_process',
  '0 1 * * *',
  $$SELECT public.process_recurring_classes()$$
);

-- ==============================================================================
-- 2. Corrigir Aulas Existentes que estão com "created_by = NULL"
-- (Atribui as aulas órfãs ao Professor dessa mesma aula para que não fiquem NULL)
-- ==============================================================================
UPDATE public.classes
SET created_by = professor_id
WHERE created_by IS NULL;

-- ==============================================================================
-- 3. ELIMINAR AULAS FANTASMAS E DUPLICADOS (COM PROTEÇÃO MÁXIMA)
-- Este comando escolhe preservar TODAS as aulas que tenham inscritos.
-- Se houverem múltiplas cópias duplicadas, ele tenta preservar a que 
-- tem o maior número de alunos, apagando os clones VAZIOS.
-- ==============================================================================
DELETE FROM public.classes
WHERE id IN (
  SELECT id FROM (
    SELECT id,
           -- Prioriza manter a aula com mais inscrições e depois a criada primeiro
           ROW_NUMBER() OVER (
             PARTITION BY title, date, start_time, school_id
             ORDER BY 
               (SELECT COUNT(*) FROM public.class_bookings WHERE class_id = public.classes.id) DESC,
               created_at ASC
           ) AS rn
    FROM public.classes
  ) ranked
  WHERE rn > 1
)
-- PROTEÇÃO EXTREMA: Nunca, em qualquer circunstância, apaga aulas COM marcações
AND id NOT IN (
  SELECT DISTINCT class_id FROM public.class_bookings
);
