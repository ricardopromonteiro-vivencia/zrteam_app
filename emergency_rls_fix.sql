-- ==============================================================================
-- 🥋 CORREÇÃO CRÍTICA DE RLS: EVITAR RECURSÃO INFINITA
-- O problema: as políticas estavam a fazer SELECT raw na própria tabela profiles.
-- Solução: usar funções SECURITY DEFINER auxiliares.
-- ==============================================================================

-- 1. Funções Auxiliares Seguras (Security Definer ignora RLS interno)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Limpar políticas problemáticas
DROP POLICY IF EXISTS "RLS_ADMIN_ALL" ON public.profiles;
DROP POLICY IF EXISTS "RLS_SELF_UPDATE" ON public.profiles;
DROP POLICY IF EXISTS "RLS_PROFS_UPDATE_OTHERS" ON public.profiles;
DROP POLICY IF EXISTS "RLS_SELF_SELECT" ON public.profiles;
DROP POLICY IF EXISTS "RLS_ADMIN_SELECT" ON public.profiles;
DROP POLICY IF EXISTS "RLS_PROFS_SELECT" ON public.profiles;
DROP POLICY IF EXISTS "Perfil próprio sempre visível" ON public.profiles;
DROP POLICY IF EXISTS "Admin vê todos" ON public.profiles;
DROP POLICY IF EXISTS "Profs veem perfis da sua escola" ON public.profiles;

-- 3. Políticas de LEITURA (SELECT)
CREATE POLICY "RLS_PROFILES_SELF_SELECT" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "RLS_PROFILES_ADMIN_SELECT" ON public.profiles
    FOR SELECT USING (public.get_auth_role() = 'Admin');

CREATE POLICY "RLS_PROFILES_SCHOOL_SELECT" ON public.profiles
    FOR SELECT USING (
        public.get_auth_role() IN ('Professor', 'Professor Responsável')
        AND school_id = public.get_auth_school_id()
    );

-- 4. Políticas de ESCRITA (UPDATE)
-- (O trigger tr_protect_profile_fields_v2 tratará de bloquear a coluna 'role' e administrativos)
CREATE POLICY "RLS_PROFILES_SELF_UPDATE" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "RLS_PROFILES_ADMIN_UPDATE" ON public.profiles
    FOR UPDATE USING (public.get_auth_role() = 'Admin');

CREATE POLICY "RLS_PROFILES_SCHOOL_UPDATE" ON public.profiles
    FOR UPDATE USING (
        public.get_auth_role() IN ('Professor', 'Professor Responsável')
        AND school_id = public.get_auth_school_id()
    );

-- 5. Outros (INSERT/DELETE apenas Admin ou sistema via triggers)
CREATE POLICY "RLS_PROFILES_ADMIN_ALL" ON public.profiles
    FOR ALL USING (public.get_auth_role() = 'Admin');
