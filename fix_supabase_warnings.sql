-- ==============================================================================
-- CORREÇÃO DOS AVISOS DE SEGURANÇA (LINTER) DO SUPABASE
-- ==============================================================================

-- 1. function_search_path_mutable
-- A função notify_push_on_announcement não tinha o search_path definido
ALTER FUNCTION public.notify_push_on_announcement() SET search_path = public;

-- 2. rls_policy_always_true
-- A tabela announcements tinha uma política para a "service_role" com "WITH CHECK (true)".
-- Isto é desnecessário e perigoso, porque a service_role nativamente já faz bypass ao RLS.
-- Removendo esta política, resolvemos a falha sem afetar o sistema.
DROP POLICY IF EXISTS "Service role can insert announcements" ON public.announcements;

-- 3. public_bucket_allows_listing
-- O bucket "store_products" tinha um SELECT permissivo para toda a gente (anon).
-- Isto permite que qualquer pessoa liste os ficheiros da store. Como o bucket é público,
-- as imagens continuam a funcionar via URL normalmente. Limitamos o SELECT apenas a utilizadores autenticados.
DROP POLICY IF EXISTS "Public Access Store" ON storage.objects;

CREATE POLICY "Public Access Store" 
ON storage.objects 
FOR SELECT 
TO authenticated 
USING (bucket_id = 'store_products');

-- 4. pg_graphql_anon_table_exposed
-- O Supabase avisa que o GraphQL permite "ver" a estrutura (schema) das tabelas de forma anónima.
-- Como a plataforma usa a API REST normal e não GraphQL, podemos simplesmente revogar
-- o acesso do utilizador 'anon' ao schema do graphql.
REVOKE USAGE ON SCHEMA graphql FROM anon;

-- Nota: O aviso "Leaked Password Protection Disabled" foi ignorado conforme solicitado.
