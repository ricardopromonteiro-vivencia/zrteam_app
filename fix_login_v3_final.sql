-- ==============================================================================
-- 🥋 FIX LOGIN v3 - CORREÇÃO DEFINITIVA DO ERRO 500
-- Problema: A query do Layout usa joins self-referentes (profiles!assigned_professor_id)
-- que disparam recursão nas políticas RLS, causando erro 500.
-- Solução: Funções SECURITY DEFINER + políticas sem recursão.
-- ==============================================================================

-- PASSO 1: Apagar TODAS as políticas existentes na tabela profiles (limpar tudo)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END $$;

-- PASSO 2: Recriar as funções helper sem recursão (lê de auth.users, não de profiles)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role'),
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid,
    (SELECT (raw_user_meta_data->>'school_id')::uuid FROM auth.users WHERE id = auth.uid())
  );
$$;

-- PASSO 3: Criar políticas NOVAS, simples e sem recursão

-- Política 1: Cada utilizador autenticado pode VER o seu próprio perfil
-- (NECESSÁRIO para o login funcionar - sem isso, o Layout não consegue carregar o perfil)
CREATE POLICY "own_profile_select"
ON public.profiles
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Política 2: Admin pode fazer tudo (usa JWT, sem tocar na tabela profiles)
CREATE POLICY "admin_full_access"
ON public.profiles
FOR ALL
TO authenticated
USING (public.get_auth_role() = 'Admin');

-- Política 3: Professores e Prof. Responsáveis podem VER perfis da sua escola
-- + podem ver outros professores (needed para o join assigned_professor)
CREATE POLICY "professor_select_school"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.get_auth_role() IN ('Professor', 'Professor Responsável')
  AND (
    school_id = public.get_auth_school_id()
    OR role IN ('Professor', 'Professor Responsável', 'Admin')
  )
);

-- Política 4: Professores podem ATUALIZAR atletas da sua escola
CREATE POLICY "professor_update_school"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.get_auth_role() IN ('Professor', 'Professor Responsável')
  AND school_id = public.get_auth_school_id()
);

-- Política 5: Atletas podem ver perfis de professores/admins (para o dropdown de registo e join)
-- Esta política é CRÍTICA para o join assigned_professor:profiles!assigned_professor_id
CREATE POLICY "public_professor_profiles"
ON public.profiles
FOR SELECT
USING (role IN ('Professor', 'Professor Responsável', 'Admin'));

-- Política 6: Cada utilizador pode ATUALIZAR e INSERIR o seu próprio perfil
CREATE POLICY "own_profile_write"
ON public.profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid());

CREATE POLICY "own_profile_insert"
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- PASSO 4: Garantir que RLS está ativo na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- PASSO 5: Garantir visibilidade das escolas (necessário para o login)
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

CREATE POLICY "schools_public_read"
ON public.schools
FOR SELECT
USING (true);

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- ✅ VERIFICAÇÃO FINAL
-- Após correr este script, verifica no Supabase > Authentication > SQL Editor:
--   SELECT * FROM pg_policies WHERE tablename = 'profiles';
-- Deverás ver apenas as políticas criadas acima.
-- 
-- 🚨 PASSOS APÓS CORRER:
-- 1. Faz logout da aplicação
-- 2. Limpa o localStorage (F12 > Application > Local Storage > Clear All)
-- 3. Fecha e reabre o browser (ou usa aba anónima)
-- 4. Tenta fazer login novamente
-- ==============================================================================
