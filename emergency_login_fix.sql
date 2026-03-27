-- ==============================================================================
-- 🥋 CORREÇÃO DE EMERGÊNCIA: LOGIN E REGISTO (RLS)
-- ==============================================================================

-- 1. Permitir que cada utilizador veja o seu próprio perfil
-- IMPORTANTE: Isto resolve o problema de o Layout.tsx forçar logout por não conseguir ler o perfil.
DROP POLICY IF EXISTS "Utilizadores veem o próprio perfil" ON public.profiles;
CREATE POLICY "Utilizadores veem o próprio perfil"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- 2. Permitir que qualquer pessoa (incluindo visitantes/anon) veja a lista de professores
-- Necessário para o formulário de registo e para os JOINs de 'assigned_professor' no Layout.
DROP POLICY IF EXISTS "Perfis administrativos são visíveis publicamente" ON public.profiles;
CREATE POLICY "Perfis administrativos são visíveis publicamente"
ON public.profiles
FOR SELECT
USING (role IN ('Professor', 'Professor Responsável', 'Admin'));

-- 3. Garantir que as Escolas são visíveis para todos (pelo menos o nome e ID)
-- Necessário para carregar a lista de escolas no ecrã de login/registo.
DROP POLICY IF EXISTS "Escolas são visíveis para todos" ON public.schools;
CREATE POLICY "Escolas são visíveis para todos"
ON public.schools
FOR SELECT
USING (true);

-- 4. Ajuste na política Cross-School (Remover se existir para evitar conflitos)
-- A política RLS_PROFILES_CROSS_SCHOOL_SELECT já existia mas era restritiva demais (não incluía o próprio utilizador).
-- Com as políticas acima, esta torna-se redundante ou pode ser mantida para visibilidade extra de Admins se necessário.
-- Mas a "Perfis administrativos são visíveis publicamente" já cobre a maior parte das necessidades de listagem.

-- NOTA: Aplica este SQL no SQL Editor do Supabase para restaurar o acesso imediato.
