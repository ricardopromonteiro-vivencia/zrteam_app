-- ==============================================================================
-- 🥋 ZR TEAM APP — CORREÇÃO: CRIAÇÃO SEGURA DE AULAS RECORRENTES (CRON JOB)
-- Este script move a lógica de criação de aulas recorrentes do frontend
-- para uma função na base de dados, evitando "Race Conditions" e duplicação
-- de aulas quando múltiplos professores abrem a App em simultâneo.
-- ==============================================================================

-- 1. Criação da função segura para processar as aulas recorrentes
CREATE OR REPLACE FUNCTION public.process_recurring_classes()
RETURNS void AS $$
DECLARE
  v_class record;
  v_next_date date;
  v_exists boolean;
BEGIN
  -- Percorre todas as aulas marcadas como recorrentes nos últimos 7 dias
  FOR v_class IN
    SELECT * FROM public.classes
    WHERE is_recurring = true
      AND date >= (CURRENT_DATE - INTERVAL '7 days')::date
      AND date <= CURRENT_DATE
  LOOP
    -- Calcula a data para a próxima semana (mesmo dia da semana)
    v_next_date := v_class.date + INTERVAL '7 days';

    -- Verifica se já existe uma aula com o mesmo título, escola, data e hora de início
    SELECT EXISTS (
      SELECT 1 FROM public.classes
      WHERE title = v_class.title
        AND date = v_next_date
        AND start_time = v_class.start_time
        AND (school_id = v_class.school_id OR (school_id IS NULL AND v_class.school_id IS NULL))
    ) INTO v_exists;

    -- Se não existir, cria a aula para a próxima semana
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
        true,
        v_class.second_professor_id
      );
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Agendamento do Cron Job para correr todas as madrugadas (01:00 AM)
-- Nota: Caso já exista um job com este nome, o cron.schedule irá atualizá-lo.
SELECT cron.schedule(
  'daily_recurring_classes_process',
  '0 1 * * *', -- Minuto 0, Hora 1 (01:00 AM) todos os dias
  $$SELECT public.process_recurring_classes()$$
);

-- FIM DO SCRIPT
