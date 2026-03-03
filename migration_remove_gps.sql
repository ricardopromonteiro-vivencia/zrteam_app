-- ============================================================
-- MIGRAÇÃO: Remoção de GPS e Localização
-- Remove colunas GPS da tabela schools.
-- SEGURO: Usa IF EXISTS em tudo — não dá erro se já não existir.
-- ============================================================

-- 1. Remover colunas GPS da tabela schools
ALTER TABLE public.schools
    DROP COLUMN IF EXISTS latitude,
    DROP COLUMN IF EXISTS longitude,
    DROP COLUMN IF EXISTS radius_meters;

-- 2. Remover funções GPS (se existirem)
DROP FUNCTION IF EXISTS public.calculate_distance(float, float, float, float);
DROP FUNCTION IF EXISTS public.secure_checkin(float, float, text);

-- Verificação: colunas actuais da tabela schools
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'schools'
  ORDER BY ordinal_position;
