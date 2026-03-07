-- ============================================================
-- MIGRATION: Push Notifications Subscriptions
-- Criação da tabela para guardar os endpoints de notificação de cada utilizador
-- ============================================================

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS: Segurança
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Utilizadores podem inserir e ler APENAS as suas próprias subscrições
DROP POLICY IF EXISTS "Users can manage own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users can manage own push subscriptions"
    ON public.push_subscriptions
    FOR ALL
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- O serviço (Edge Function ou funções RPC seguras) vai usar o role postgres/service_role
-- que ignora RLS, por isso não precisamos de política de leitura "pública" ou para admins aqui.
-- O envio da notificação será feito pelo backend usando o service_role key.
