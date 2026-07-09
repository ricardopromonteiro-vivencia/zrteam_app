-- 1. Tabela para registar tentativas e evitar ataques de Força Bruta (Brute-force/Enumeration)
CREATE TABLE IF NOT EXISTS public.email_check_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address TEXT NOT NULL,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Índice para acelerar a consulta de limites e limpeza
CREATE INDEX IF NOT EXISTS idx_email_check_logs_ip_time ON public.email_check_logs (ip_address, checked_at);

-- 3. Função segura para verificar se email existe
CREATE OR REPLACE FUNCTION check_email_exists_secure(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_exists BOOLEAN;
    v_client_ip TEXT;
    v_recent_attempts INT;
BEGIN
    -- Extrair o IP do cliente através dos cabeçalhos do PostgREST
    BEGIN
        v_client_ip := (current_setting('request.headers', true)::json->>'x-forwarded-for');
    EXCEPTION WHEN OTHERS THEN
        v_client_ip := 'unknown';
    END;
    
    IF v_client_ip IS NULL THEN
        v_client_ip := 'unknown';
    END IF;

    -- Proteção 1: Limite de taxa (Rate Limit) -> Máximo de 5 verificações por IP a cada 15 minutos
    SELECT COUNT(*) 
    INTO v_recent_attempts
    FROM public.email_check_logs
    WHERE ip_address = v_client_ip 
    AND checked_at > NOW() - INTERVAL '15 minutes';

    IF v_recent_attempts >= 5 AND v_client_ip != 'unknown' THEN
        RAISE EXCEPTION 'Muitas tentativas. Por motivos de segurança, aguarda 15 minutos antes de tentar novamente.';
    END IF;

    -- Registar a tentativa
    INSERT INTO public.email_check_logs (ip_address) VALUES (v_client_ip);

    -- Limpar registos antigos do mesmo IP para não encher a base de dados
    DELETE FROM public.email_check_logs 
    WHERE ip_address = v_client_ip 
    AND checked_at < NOW() - INTERVAL '24 hours';

    -- Proteção 2: Atraso artificial (Tarpit) -> Previne ataques de timing e abranda bots (0.5 segundos)
    PERFORM pg_sleep(0.5);

    -- Verificação na tabela segura auth.users
    SELECT EXISTS (
        SELECT 1 
        FROM auth.users 
        WHERE email = p_email
    ) INTO v_exists;
    
    RETURN v_exists;
END;
$$;

-- 4. Dar permissão para utilizadores não autenticados (anon) correrem esta função
GRANT EXECUTE ON FUNCTION check_email_exists_secure(TEXT) TO anon, authenticated;
