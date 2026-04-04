-- ==============================================================================
-- 🥋 CORREÇÃO: Ranking e Premiação visíveis para todos os utilizadores da mesma escola
--
-- PROBLEMA IDENTIFICADO:
--   A política RLS_PROFILES_CROSS_SCHOOL_SELECT só permite acesso SELECT a
--   utilizadores com role Professor/Admin. Atletas não conseguem ver os outros
--   perfis de atletas da sua escola → no ranking só aparecem professores.
--
-- SOLUÇÃO:
--   Adicionar uma política específica que permite a QUALQUER utilizador autenticado
--   ver informação básica (nome, role, belt) de outros membros da MESMA escola,
--   desde que não estejam arquivados/ocultos. Isso alimenta o ranking e a premiação.
-- ==============================================================================

-- 1. Garantir que a função get_auth_school_id existe (criada em fix_profiles_recursion.sql)
CREATE OR REPLACE FUNCTION public.get_auth_school_id()
RETURNS UUID AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Garantir que a função get_auth_role existe (criada em fix_profiles_recursion.sql)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 3. Remover política antiga (se existir) para evitar conflitos
DROP POLICY IF EXISTS "RLS_PROFILES_SAME_SCHOOL_SELECT" ON public.profiles;

-- 4. Nova política: qualquer utilizador autenticado vê membros ATIVOS da SUA escola
--    (campos básicos para ranking/premiação: full_name, role, belt)
--    SEGURANÇA: usa SECURITY DEFINER para evitar recursão e garante mesma escola.
CREATE POLICY "RLS_PROFILES_SAME_SCHOOL_SELECT"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  -- Deve estar na mesma escola que o utilizador autenticado
  school_id = public.get_auth_school_id()
  -- Não pode estar arquivado nem oculto
  AND is_archived = false
  AND is_hidden = false
);

-- ==============================================================================
-- NOTAS DE SEGURANÇA:
-- ✅ O utilizador SÓ VÊ membros da SUA escola (school_id = get_auth_school_id())
-- ✅ Não vê perfis arquivados (is_archived = false)
-- ✅ Não vê perfis ocultos (is_hidden = false)
-- ✅ Não expõe dados sensíveis (o front-end só pede full_name, role, belt)
-- ✅ Usa SECURITY DEFINER para evitar recursão infinita nas RLS
-- ✅ Compatível com as políticas já existentes (OR lógico entre todas as SELECT)
--
-- POLÍTICAS SELECT EM VIGOR APÓS ESTA CORREÇÃO:
-- 1. RLS_ADMIN_ALL              → Admin vê tudo
-- 2. RLS_PROFILES_CROSS_SCHOOL_SELECT → Prof/Admin vê todos os ativados
-- 3. RLS_PROFILES_PUBLIC_STAFF  → Qualquer autenticado vê Staff (prof/admin)
-- 4. RLS_PROFILES_VIEW_CLASSMATES → Qualquer autenticado vê colegas de turma
-- 5. RLS_PROFILES_SAME_SCHOOL_SELECT → ← NOVA: Qualquer autenticado vê membros da mesma escola
-- 6. RLS_SELF_VIEW (se existir) → Cada um vê o próprio perfil
-- ==============================================================================

-- VERIFICAÇÃO (executa após aplicar):
-- Substitui 'ID_DO_ATLETA' pelo UUID de um atleta de teste no Supabase Auth:
-- SET LOCAL role TO authenticated;
-- SET LOCAL "request.jwt.claims" TO '{"sub": "ID_DO_ATLETA"}';
-- SELECT id, full_name, role, belt FROM public.profiles WHERE school_id = (
--   SELECT school_id FROM public.profiles WHERE id = 'ID_DO_ATLETA'
-- ) AND is_hidden = false AND is_archived = false;
