-- ==============================================================================
-- 🥋 CORREÇÃO DEFINITIVA: ERRO 500 E RECURSÃO DE RLS
-- ==============================================================================

-- 1. Redefinir as funções de apoio para evitar ler a própria tabela profiles
-- Ao ler de auth.users ou do JWT, quebramos o ciclo de recursão.

CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  -- Tenta obter do JWT (rápido) e faz fallback para auth.users (seguro)
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'role')::text,
    (SELECT (raw_user_meta_data->>'role')::text FROM auth.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, public;

CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID AS $$
  -- Tenta obter do JWT (rápido) e faz fallback para auth.users (seguro)
  SELECT COALESCE(
    (auth.jwt() -> 'user_metadata' ->> 'school_id')::uuid,
    (SELECT (raw_user_meta_data->>'school_id')::text::uuid FROM auth.users WHERE id = auth.uid())
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = auth, public;

-- 2. Limpar políticas existentes na tabela profiles para evitar conflitos de recursão
DROP POLICY IF EXISTS "RLS_ADMIN_ALL" ON public.profiles;
DROP POLICY IF EXISTS "RLS_PROFS_UPDATE_OTHERS" ON public.profiles;
DROP POLICY IF EXISTS "RLS_PROFILES_CROSS_SCHOOL_SELECT" ON public.profiles;
DROP POLICY IF EXISTS "Utilizadores veem o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Perfis administrativos são visíveis publicamente" ON public.profiles;

-- 3. Criar novas políticas RECURSION-FREE

-- A. Admin tem acesso total (determinado pelo JWT/Auth, não pela tabela profiles)
CREATE POLICY "RLS_ADMIN_ALL" ON public.profiles
    FOR ALL
    TO authenticated
    USING (public.get_auth_role() = 'Admin');

-- B. Ver o próprio perfil (Baseado apenas no ID, sem chamadas a funções)
CREATE POLICY "Utilizadores veem o próprio perfil"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- C. Ver nomes de Professores/Admins (Baseado na coluna da própria linha, seguro)
CREATE POLICY "Perfis administrativos são visíveis publicamente"
ON public.profiles
FOR SELECT
USING (role IN ('Professor', 'Professor Responsável', 'Admin'));

-- D. Professores podem ver Atletas da mesma escola (Cross-school select)
CREATE POLICY "RLS_PROFILES_CROSS_SCHOOL_SELECT"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.get_auth_role() IN ('Professor', 'Professor Responsável')
  AND (
    school_id = public.get_auth_school_id() -- Mesma escola
    OR 
    role IN ('Professor', 'Professor Responsável', 'Admin') -- Ou ver outros profs
  )
);

-- E. Professores podem atualizar Atletas da mesma escola
CREATE POLICY "RLS_PROFS_UPDATE_OTHERS"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.get_auth_role() IN ('Professor', 'Professor Responsável')
  AND school_id = public.get_auth_school_id()
);

-- 4. Garantir visibilidade pública de tabelas de suporte
DROP POLICY IF EXISTS "Escolas são visíveis para todos" ON public.schools;
CREATE POLICY "Escolas são visíveis para todos" ON public.schools FOR SELECT USING (true);

-- ==============================================================================
-- 💡 INSTRUÇÕES CRÍTICAS APÓS EXECUTAR ESTE SQL:
-- 1. Se o erro "Invalid Refresh Token" persistir na consola:
--    - Faz LOGOUT na aplicação.
--    - Limpa LocalStorage e Cookies (ou abre em Aba Anónima).
--    - Tenta fazer LOGIN novamente.
-- ==============================================================================
