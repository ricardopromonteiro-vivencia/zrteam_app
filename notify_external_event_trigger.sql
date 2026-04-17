-- ==============================================================================
-- 🥋 ZR TEAM — Trigger: Push Notification ao criar Evento Externo
-- Quando um registo é inserido em external_events, dispara automaticamente
-- a Edge Function send-push-notification para notificar TODOS os utilizadores.
-- ==============================================================================

-- 1. Função que chama a Edge Function via HTTP (pg_net)
CREATE OR REPLACE FUNCTION public.fn_notify_new_external_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    supabase_url TEXT := 'https://cbbxlhdscqckqwuxbbuz.supabase.co';
    service_role_key TEXT;
    v_payload JSONB;
    v_event_date TEXT;
BEGIN
    -- 1. Obter a chave do Supabase (para autorizar a chamada à Edge Function)
    BEGIN
        SELECT decrypted_secret INTO service_role_key
        FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
    EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
    
    IF service_role_key IS NULL THEN RETURN NEW; END IF;

    -- 2. Formatar a data do evento (ex: 2024-10-15 -> 15/10/2024)
    v_event_date := TO_CHAR(NEW.event_date, 'DD/MM/YYYY');

    -- 3. Construir o payload (target = 'all' para todos os utilizadores)
    v_payload := jsonb_build_object(
        'target',   'all',
        'title',    '🏆 Novo Evento: ' || NEW.name,
        'body',     'O evento realiza-se a ' || v_event_date || '. Prepara-te!',
        'url',      '/'
    );

    -- 4. Chamar a Edge Function via pg_net (HTTP POST)
    BEGIN
        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type',   'application/json',
                'Authorization',  'Bearer ' || service_role_key
            ),
            body := v_payload::text::jsonb
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Push de evento externo falhou: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$;

-- 2. Remover trigger anterior se existir (idempotente)
DROP TRIGGER IF EXISTS tr_notify_new_external_event ON public.external_events;

-- 3. Criar o trigger — dispara APÓS o INSERT
CREATE TRIGGER tr_notify_new_external_event
    AFTER INSERT ON public.external_events
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_new_external_event();

-- ==============================================================================
-- VERIFICAÇÃO: confirmar que o trigger foi criado
-- ==============================================================================
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'external_events'
ORDER BY trigger_name;
