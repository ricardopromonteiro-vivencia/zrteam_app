-- ============================================================
-- VERIFICAÇÃO: Todas as políticas RLS ativas relacionadas
-- com validação e controlo de acesso na app ZR Team
-- ============================================================
-- Corre este script no SQL Editor do Supabase e partilha o resultado.
-- ============================================================

-- 1. Ver todas as políticas RLS ativas por tabela
SELECT
    schemaname        AS schema,
    tablename         AS tabela,
    policyname        AS politica,
    permissive        AS permissiva,
    roles             AS papeis,
    cmd               AS operacao,
    qual              AS condicao_using,
    with_check        AS condicao_with_check
FROM pg_policies
WHERE schemaname IN ('public', 'auth')
ORDER BY tablename, cmd;

-- ============================================================
-- 2. Ver se RLS está ativa em cada tabela crítica
SELECT
    schemaname,
    tablename,
    rowsecurity AS rls_ativa
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'classes', 'class_bookings', 'payments', 'announcements', 'schools')
ORDER BY tablename;

-- ============================================================
-- 3. Verificar se a função is_validated() existe
SELECT
    routine_name,
    routine_type,
    security_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('is_validated', 'validate_user', 'delete_user_and_auth', 'handle_new_user_validation')
ORDER BY routine_name;

-- ============================================================
-- 4. Contar atletas pendentes de validação (por escola)
SELECT
    s.name AS escola,
    COUNT(p.id) AS pendentes
FROM public.profiles p
LEFT JOIN public.schools s ON s.id = p.school_id
WHERE p.needs_validation = TRUE
  AND p.role = 'Atleta'
GROUP BY s.name
ORDER BY pendentes DESC;

-- ============================================================
-- 5. Verificar se as colunas novas existem em profiles
SELECT
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('needs_validation', 'is_archived')
ORDER BY column_name;
