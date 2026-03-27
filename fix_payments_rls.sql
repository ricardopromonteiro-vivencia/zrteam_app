-- ==============================================================================
-- 🥋 FIX: RLS PARA A TABELA PAYMENTS
-- Resolução do erro "new row violates row-level security policy" para professores.
-- ==============================================================================

-- 1. Garantir que o RLS está ativado
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 2. Limpar TODAS as políticas existentes na tabela payments para evitar duplicados ou sobreposições
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN
        SELECT policyname
        FROM pg_policies
        WHERE tablename = 'payments' AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.payments', pol.policyname);
    END LOOP;
END
$$;

-- 3. Criar as Novas Políticas Seguras

-- Política 1: Administradores têm acesso total a tudo
CREATE POLICY "Admin tem acesso total aos pagamentos" ON public.payments
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin'
    );

-- Política 2: Professores (e Responsáveis) gerem (CRUD) os pagamentos da sua escola
CREATE POLICY "Professores gerem pagamentos da sua escola" ON public.payments
    FOR ALL USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Professor', 'Professor Responsável')
        AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    );

-- Política 3: Atletas podem apenas ver os seus próprios pagamentos
CREATE POLICY "Atletas veem apenas os seus próprios pagamentos" ON public.payments
    FOR SELECT USING (
        athlete_id = auth.uid()
    );

-- Fim do script
