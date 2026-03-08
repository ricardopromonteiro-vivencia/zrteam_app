-- ============================================================
-- SCRIPT DE LIMPEZA GERAL DE EXCEÇÕES (Opcional)
-- Este script apaga as funções e políticas que criámos
-- para forçar a visualização do professor e que afinal
-- não eram precisas, pois o erro era de frontend.
-- ============================================================

-- 1. Remover Política "Everyone can read professors and admins" (de migration_fix_professor_read.sql)
DROP POLICY IF EXISTS "Everyone can read professors and admins" ON public.profiles;

-- 2. Remover Função e Política Supremas (de migration_forze_assigned_professor_read.sql)
DROP POLICY IF EXISTS "Read assigned professor" ON public.profiles;
DROP FUNCTION IF EXISTS public.get_my_assigned_professor_id() CASCADE;

-- 3. Nota: O RLS que tínhamos na Phase 9 e RLS Validation block mantêm a segurança perfeitamente e é tudo o que precisas.
