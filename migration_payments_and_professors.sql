-- 🥋 Expansão de Funcionalidades: Pagamentos e Gestão de Professores
-- Autor: Monteirismo

-- 1. Atribuição de Professor a Atleta
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS assigned_professor_id UUID REFERENCES public.profiles(id);

-- 2. Tabela de Pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pago', 'Pendente')) DEFAULT 'Pendente',
    amount DECIMAL(10,2),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(athlete_id, month, year) -- Um pagamento por mês/ano por atleta
);

-- Ativar RLS para pagamentos
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilizadores podem ver os seus pagamentos" ON public.payments
    FOR SELECT USING (auth.uid() = athlete_id);

CREATE POLICY "Prof/Admin gerem pagamentos da sua escola" ON public.payments
    FOR ALL USING (
        public.get_auth_role() IN ('Admin', 'Professor') 
        AND (
            public.get_auth_role() = 'Admin' 
            OR school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
        )
    );

-- 3. Atualizar Lista Oficial de Faixas (Nova Ordem e Nomes)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_belt_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_belt_check CHECK (belt IN (
    'Cinza/ branco', 'Cinza', 'Cinza/ Preto',
    'Amarelo / Branco', 'Amarelo', 'Amarelo/ preto',
    'Laranja/ Branco', 'Laranja', 'Laranja/ preto',
    'Verde / Branco', 'Verde', 'Verde / Preto',
    'Branco', 'Azul', 'Roxo', 'Marrom', 'Preto'
));

-- 4. Função para Apagar Conta Própria (Segurança)
-- No Supabase, apagar da pública não apaga do Auth. Precisamos de uma função SECURITY DEFINER.
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void AS $$
BEGIN
  -- Apagar da tabela profiles (o ON DELETE CASCADE tratará do resto na pública)
  -- Mas para apagar mesmo o utilizador do sistema (Auth), isto precisa de ser feito com cuidado.
  -- Por agora, apagamos os dados sensíveis da pública. 
  -- Nota: Para apagar o AUTH user, é necessário usar a Admin API do Supabase no backend ou Edge Functions.
  -- No entanto, apagar o profile é o primeiro passo.
  DELETE FROM public.profiles WHERE id = auth.uid();
  -- O utilizador perderá acesso pois o RLS e o Layout dependem do profile.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
