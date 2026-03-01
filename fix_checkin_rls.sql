-- 🛡️ Correção de Segurança: Permissões para Check-in Manual
-- Autor: Monteirismo

-- 1. Permitir que Professores e Admin criem reservas (Criação de presenças manuais)
DROP POLICY IF EXISTS "Utilizadores podem criar reservas para si mesmos" ON public.class_bookings;

CREATE POLICY "Utilizadores criam para si e Prof/Admin para todos" ON public.class_bookings
    FOR INSERT WITH CHECK (
        auth.uid() = user_id OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
    );

-- 2. Garantir que Professores e Admin podem ver todos os inscritos (necessário para a lista)
DROP POLICY IF EXISTS "Professores e Admin podem ver todas as reservas" ON public.class_bookings;

CREATE POLICY "Professores e Admin podem ver todas as reservas" ON public.class_bookings
    FOR SELECT USING (
        auth.uid() = user_id OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
    );

-- 3. Permitir que Professores/Admin atualizem o estado (Já deve existir, mas reforçamos)
DROP POLICY IF EXISTS "Professores e Admin podem atualizar o estado (presença/falta)" ON public.class_bookings;

CREATE POLICY "Professores e Admin podem atualizar o estado (presença/falta)" ON public.class_bookings
    FOR UPDATE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
    );

-- 4. Permitir que Professores vejam perfis para o JOIN da lista
DROP POLICY IF EXISTS "Admin e Professores podem ver todos os perfis" ON public.profiles;

CREATE POLICY "Admin e Professores podem ver todos os perfis" ON public.profiles
    FOR SELECT USING (
        auth.uid() = id OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
    );

-- 💡 Dica: Se o erro "infinite recursion" aparecer, usa auth.jwt() para o role.
