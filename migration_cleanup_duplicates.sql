-- ==============================================================================
-- CLEANUP SCRIPT: Apagar Aulas Duplicadas
-- Este script limpa de forma segura todos os duplicados exatos de aulas
-- (mesmo título, mesma data, mesma hora e mesma escola), mantendo apenas a
-- versão original (a primeira a ser criada).
-- ==============================================================================

WITH duplicates AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY title, date, start_time, school_id
           ORDER BY created_at ASC
         ) as row_num
  FROM public.classes
)
DELETE FROM public.classes
WHERE id IN (
  SELECT id FROM duplicates WHERE row_num > 1
);
