-- 🚨 HOTFIX: Resolução de Erro 500 (Recursividade Infinita no RLS)
-- Autor: Monteirismo

-- 1. Criar função auxiliar para ler o papel do utilizador sem disparar o RLS
-- O segredo está no "SECURITY DEFINER", que ignora as políticas de RLS para esta consulta específica.
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- 2. Limpar políticas problemáticas na tabela profiles
DROP POLICY IF EXISTS "Admin e Professores podem ver todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Utilizadores podem ver o seu próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Apenas Admin podem atualizar qualquer perfil" ON public.profiles;

-- 3. Recriar políticas de profiles de forma segura (usando a nova função)
CREATE POLICY "Profiles select policy" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR 
        public.get_auth_role() IN ('Admin', 'Professor')
    );

CREATE POLICY "Profiles update policy" ON public.profiles
    FOR UPDATE USING (
        public.get_auth_role() = 'Admin'
    );

-- 4. Corrigir políticas de class_bookings para evitar a mesma recursividade
DROP POLICY IF EXISTS "Utilizadores criam para si e Prof/Admin para todos" ON public.class_bookings;
DROP POLICY IF EXISTS "Professores e Admin podem ver todas as reservas" ON public.class_bookings;
DROP POLICY IF EXISTS "Professores e Admin podem atualizar o estado (presença/falta)" ON public.class_bookings;
DROP POLICY IF EXISTS "Utilizadores podem ver as suas reservas" ON public.class_bookings;
DROP POLICY IF EXISTS "Utilizadores podem criar reservas para si mesmos" ON public.class_bookings;

CREATE POLICY "Bookings select policy" ON public.class_bookings
    FOR SELECT USING (
        auth.uid() = user_id OR 
        public.get_auth_role() IN ('Admin', 'Professor')
    );

CREATE POLICY "Bookings insert policy" ON public.class_bookings
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        public.get_auth_role() IN ('Admin', 'Professor')
    );

CREATE POLICY "Bookings update policy" ON public.class_bookings
    FOR UPDATE USING (
        public.get_auth_role() IN ('Admin', 'Professor')
    );

CREATE POLICY "Bookings delete policy" ON public.class_bookings
    FOR DELETE USING (
        auth.uid() = user_id OR
        public.get_auth_role() = 'Admin'
    );

-- ✅ Agora o sistema deve carregar sem erros 500 e permitir o check-in manual.
