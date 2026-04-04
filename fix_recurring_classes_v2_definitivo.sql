-- ==============================================================================
-- 🥋 FIX DEFINITIVO — AULAS RECORRENTES DUPLICADAS
-- Versão: v2 — 2026-04-02
-- Problema: Duplicados + aulas criadas no dia errado
-- ==============================================================================

-- ==============================================================================
-- PASSO 1: DIAGNÓSTICO — Verificar se há jobs duplicados (correr primeiro!)
-- ==============================================================================
-- Corre esta query ANTES para ver quantos jobs existem:
-- SELECT jobid, jobname, schedule, command, active FROM cron.job ORDER BY jobid;

-- ==============================================================================
-- PASSO 2: ELIMINAR TODOS os jobs de aulas recorrentes (evitar duplicação)
-- O cron.schedule() do Supabase NÃO substitui um job existente pelo mesmo nome
-- — cria um NOVO job com jobid diferente. Por isso, removemos todos primeiro.
-- ==============================================================================
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE command ILIKE '%process_recurring_classes%'
   OR jobname ILIKE '%recurring%'
   OR jobname ILIKE '%recorr%';

-- ==============================================================================
-- PASSO 3: SUBSTITUIR A FUNÇÃO PRINCIPAL (versão robusta e definitiva)
-- Melhorias:
--   a) Usa EXTRACT(DOW) em vez do título para deduplificação (mais fiável)
--   b) Usa AT TIME ZONE 'Europe/Lisbon' para evitar bugs de timezone
--   c) Regista logs para auditoria
--   d) A verificação de "já existe" é por (school_id, day_of_week, start_time)
--      que é a chave real de uma aula recorrente, não o título que pode mudar
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_recurring_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class        record;
  v_next_date    date;
  v_exists       boolean;
  v_today        date;
  v_yesterday    date;
BEGIN
  -- Usar SEMPRE o timezone de Portugal para evitar bugs de "dia errado"
  v_today     := (NOW() AT TIME ZONE 'Europe/Lisbon')::date;
  v_yesterday := v_today - INTERVAL '1 day';

  RAISE LOG '[process_recurring_classes] A correr. Hoje (Lisboa): %, Ontem: %', v_today, v_yesterday;

  -- Buscar APENAS aulas que aconteceram ontem (hora de Lisboa)
  FOR v_class IN
    SELECT * FROM public.classes
    WHERE is_recurring = true
      AND date = v_yesterday
  LOOP
    -- A próxima ocorrência é sempre 7 dias depois (mesmo dia da semana garantido)
    v_next_date := v_class.date + 7;

    -- Verificação de duplicado:
    -- Usamos school_id + start_time + EXTRACT(DOW from date) como chave única
    -- NOTA: não usamos o título porque pode ter sido editado numa semana anterior
    SELECT EXISTS (
      SELECT 1
      FROM public.classes
      WHERE date       = v_next_date
        AND start_time = v_class.start_time
        AND EXTRACT(DOW FROM date) = EXTRACT(DOW FROM v_next_date) -- dia da semana tem de ser igual
        AND (
          (school_id = v_class.school_id)
          OR (school_id IS NULL AND v_class.school_id IS NULL)
        )
    ) INTO v_exists;

    IF v_exists THEN
      RAISE LOG '[process_recurring_classes] Já existe aula para % às % na escola %. A saltar.', 
        v_next_date, v_class.start_time, v_class.school_id;
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

      RAISE LOG '[process_recurring_classes] ✅ Criada aula "%" para % às %.', 
        v_class.title, v_next_date, v_class.start_time;
    END IF;
  END LOOP;

  RAISE LOG '[process_recurring_classes] ✅ Concluído.';
END;
$$;

-- ==============================================================================
-- PASSO 4: AGENDAR O CRON — UMA ÚNICA VEZ (à 01:00 UTC = 02:00 Lisboa)
-- ==============================================================================
SELECT cron.schedule(
  'daily_recurring_classes_process',   -- nome único do job
  '0 1 * * *',                         -- 01:00 UTC todos os dias
  $$SELECT public.process_recurring_classes()$$
);

-- Confirmar que existe apenas 1 job:
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE command ILIKE '%process_recurring_classes%';

-- ==============================================================================
-- PASSO 5: LIMPAR DUPLICADOS EXISTENTES (com proteção máxima)
-- Mantém sempre a aula com mais inscrições ou a criada primeiro.
-- NUNCA elimina aulas que tenham inscrições.
-- ==============================================================================

-- 5a. Ver os duplicados antes de eliminar (para confirmar):
-- SELECT title, date, start_time, school_id, COUNT(*) as total
-- FROM public.classes
-- GROUP BY title, date, start_time, school_id
-- HAVING COUNT(*) > 1
-- ORDER BY date DESC;

-- 5b. Eliminar duplicados (apenas aulas SEM inscrições):
DELETE FROM public.classes
WHERE id IN (
  SELECT id FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY
          -- Chave de duplicado: dia, horário e escola
          date,
          start_time,
          COALESCE(school_id::text, 'NULL'),
          EXTRACT(DOW FROM date)  -- garante que é o mesmo dia da semana
        ORDER BY
          -- Preserva a com mais inscrições; em caso de empate, a mais antiga
          (SELECT COUNT(*) FROM public.class_bookings WHERE class_id = public.classes.id) DESC,
          created_at ASC
      ) AS rn
    FROM public.classes
  ) ranked
  WHERE rn > 1
)
-- PROTEÇÃO CRÍTICA: Nunca elimina aulas com inscrições
AND id NOT IN (
  SELECT DISTINCT class_id FROM public.class_bookings
);

-- Verificar o resultado:
SELECT 
  title, 
  date, 
  start_time, 
  school_id, 
  COUNT(*) as total,
  CASE WHEN COUNT(*) > 1 THEN '⚠️ AINDA DUPLICADO' ELSE '✅ OK' END as estado
FROM public.classes
GROUP BY title, date, start_time, school_id
HAVING COUNT(*) > 1 OR true  -- remover "OR true" para ver só duplicados
ORDER BY total DESC, date DESC
LIMIT 50;

-- ==============================================================================
-- PASSO 6: CORREÇÃO DE AULAS COM 'created_by = NULL'
-- (Atribui ao professor da aula para não ficarem órfãs)
-- ==============================================================================
UPDATE public.classes
SET created_by = professor_id
WHERE created_by IS NULL
  AND professor_id IS NOT NULL;

-- ==============================================================================
-- RESUMO DO QUE ESTE SCRIPT FAZ:
-- 1. Remove TODOS os cron jobs de aulas recorrentes (evita duplicação causada
--    por cron.schedule() que cria novos jobs em vez de substituir)
-- 2. Recria a função com timezone correto (Europe/Lisbon) e logs de auditoria
-- 3. Cria UM único cron job novo
-- 4. Limpa duplicados existentes (protegendo aulas com inscrições)
-- 5. Corrige aulas com created_by = NULL
-- ==============================================================================
