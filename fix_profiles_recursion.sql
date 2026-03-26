-- ==============================================================================
-- 🚨 CORREÇÃO DEFINITIVA DA RECURSÃO INFINITA EM PROFILES E CHECK-IN
-- O problema: as políticas estavam a fazer SELECT na tabela profiles diretamente.
-- Solução: usar funções SECURITY DEFINER para ler o role/school de forma segura.
-- ==============================================================================

-- 1. Assegurar as funções auxiliares SECURITY DEFINER (ignoram as regras próprias do RLS para evitar o loop)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Limpar políticas com recursão (que podem ter vindo da security_v2_profiles_revisado.sql) e políticas velhas de checkin
DROP POLICY IF EXISTS "RLS_ADMIN_ALL" ON public.profiles;
DROP POLICY IF EXISTS "RLS_PROFS_UPDATE_OTHERS" ON public.profiles;
DROP POLICY IF EXISTS "Professor can read all athlete profiles for checkin" ON public.profiles;
DROP POLICY IF EXISTS "Admin and Prof read all athlete profiles for checkin" ON public.profiles;
DROP POLICY IF EXISTS "RLS_PROFILES_CROSS_SCHOOL_SELECT" ON public.profiles;

-- 3. Recriar RLS_ADMIN_ALL (Sem SELECT nativo, usando a função para que nunca entre num loop)
CREATE POLICY "RLS_ADMIN_ALL" ON public.profiles
    FOR ALL
    USING (public.get_auth_role() = 'Admin');

-- 4. Recriar RLS_PROFS_UPDATE_OTHERS (Segura, também sem acesso direto)
CREATE POLICY "RLS_PROFS_UPDATE_OTHERS" ON public.profiles
    FOR UPDATE
    USING (
        public.get_auth_role() IN ('Professor', 'Professor Responsável')
        AND school_id = public.get_auth_school_id()
    );

-- 5. Política de Pesquisa de Atletas Unida: Admins e Professores
-- Torna os atletas desativados invisíveis à pesquisa, e ativa visibilidade cross-escola
CREATE POLICY "RLS_PROFILES_CROSS_SCHOOL_SELECT"
ON public.profiles
FOR SELECT
USING (
  public.get_auth_role() IN ('Professor', 'Professor Responsável', 'Admin')
  AND (
    (is_archived = false AND is_hidden = false)
    OR role IN ('Professor', 'Professor Responsável', 'Admin')
  )
);
