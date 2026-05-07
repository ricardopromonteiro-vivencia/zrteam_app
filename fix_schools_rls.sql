-- ==============================================================================
-- 🥋 FIX: RLS policies da tabela schools
-- Problema: O fix_login_v3_final.sql apagou TODAS as políticas de schools e
--           só recriou o SELECT público. A política de gestão (INSERT/UPDATE/DELETE)
--           para Admin foi perdida, causando erro 403 Forbidden ao criar/editar escolas.
-- Solução: Recriar todas as políticas de schools corretamente.
-- ==============================================================================

-- PASSO 1: Apagar todas as políticas existentes na tabela schools (limpar tudo)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname FROM pg_policies WHERE tablename = 'schools' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.schools', pol.policyname);
    END LOOP;
END $$;

-- PASSO 2: Recriar as políticas

-- Política 1: Escolas visíveis para todos (autenticados e anónimos — necessário para login/registo)
CREATE POLICY "schools_public_read"
ON public.schools
FOR SELECT
USING (true);

-- Política 2: Apenas Admin pode inserir, atualizar e eliminar escolas
CREATE POLICY "schools_admin_insert"
ON public.schools
FOR INSERT
TO authenticated
WITH CHECK (public.get_auth_role() = 'Admin');

CREATE POLICY "schools_admin_update"
ON public.schools
FOR UPDATE
TO authenticated
USING (public.get_auth_role() = 'Admin')
WITH CHECK (public.get_auth_role() = 'Admin');

CREATE POLICY "schools_admin_delete"
ON public.schools
FOR DELETE
TO authenticated
USING (public.get_auth_role() = 'Admin');

-- PASSO 3: Garantir que RLS está ativo
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- ✅ VERIFICAÇÃO
-- Após correr, verifica as políticas:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'schools';
-- Deverás ver:
--   schools_public_read   | SELECT
--   schools_admin_insert  | INSERT
--   schools_admin_update  | UPDATE
--   schools_admin_delete  | DELETE
-- ==============================================================================
