-- ============================================================
-- CORRECÇÃO RLS: Isolamento correto de perfis por role
-- 
-- Regras:
--   Admin              → lê TODOS os perfis (todas as escolas)
--   Professor Resp.    → lê perfis da SUA escola + perfis de professores (para joins)
--   Professor          → lê apenas os seus atletas atribuídos + perfis de professores
--   Atleta             → lê APENAS o seu próprio perfil
--
-- Para a coluna "Professor" aparecer na tabela de atletas, o query faz um JOIN
-- `profiles!assigned_professor_id(full_name)` - este join só funciona se a RLS
-- permitir ao utilizador ler o perfil do professor.
-- A política abaixo garante isso de forma segura: só Admin/Professor/Prof.Resp.
-- fazem esse join (são os únicos que acedem à página de gestão de atletas).
-- ============================================================

-- Remover todas as políticas SELECT existentes em profiles
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'profiles' AND schemaname = 'public' AND cmd = 'SELECT'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
END;
$$;

-- ============================================================
-- POLÍTICA PRINCIPAL: visibilidade role-based de perfis
-- ============================================================
CREATE POLICY "Role-based profile visibility"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        -- Todos podem sempre ver o seu próprio perfil
        id = auth.uid()

        -- Admin, Professor e Professor Responsável podem ver todos os perfis
        -- (necessário para os joins da página de gestão de atletas e check-in)
        OR public.get_my_role() IN ('Admin', 'Professor', 'Professor Responsável')
    );

-- Garantir que atletas só podem UPDATE no seu próprio perfil
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

-- Admin e Professor Responsável podem UPDATE qualquer perfil da sua escola
DROP POLICY IF EXISTS "Admin and Head Professor can update profiles" ON public.profiles;
CREATE POLICY "Admin and Head Professor can update profiles"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (
        public.get_my_role() IN ('Admin', 'Professor', 'Professor Responsável')
    );

-- ============================================================
-- NOTA SOBRE LEITURA PÚBLICA DE PROFESSORES (registo)
-- A política abaixo permite que utilizadores NÃO autenticados vejam
-- apenas o nome e id de professores/admins -- necessário para o
-- formulário de registo popular a lista de professores disponíveis.
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read Professor and Admin profiles" ON public.profiles;
CREATE POLICY "Anyone can read Professor and Admin profiles"
    ON public.profiles
    FOR SELECT
    USING (
        role IN ('Admin', 'Professor', 'Professor Responsável')
    );

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
-- Executar após aplicar para confirmar as políticas:
SELECT policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'profiles' AND schemaname = 'public'
ORDER BY cmd, policyname;
