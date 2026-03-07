-- ============================================================
-- MIGRATION: Triggers para notificações push automáticas
-- via Supabase Edge Function "send-push-notification"
-- 
-- IMPORTANTE: Requer a extensão pg_net (ativa por padrão no Supabase)
-- e a Edge Function "send-push-notification" deployada primeiro.
-- ============================================================

-- URL base do projeto Supabase (substituir pelo URL real sem trailing slash)
-- Guarda este valor como constante para reutilização
DO $$
BEGIN
    -- Verifica se pg_net está disponível
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
        RAISE NOTICE 'Extensão pg_net não encontrada. Ativa-a no Supabase Dashboard > Database > Extensions';
    END IF;
END;
$$;

-- ============================================================
-- FUNÇÃO: Notificar quando um novo AVISO é publicado
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_push_on_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
    service_role_key TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1);
    target_text TEXT;
BEGIN
    -- Target: todos os utilizadores, ou apenas a escola do admin que publicou
    IF NEW.school_id IS NOT NULL THEN
        target_text := format('{"school_id": "%s"}', NEW.school_id);
    ELSE
        target_text := '"all"';
    END IF;

    -- Chamar a Edge Function via HTTP (pg_net)
    PERFORM net.http_post(
        url := supabase_url || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || service_role_key
        ),
        body := jsonb_build_object(
            'target', target_text::jsonb,
            'title', '📢 Novo Aviso ZR Team',
            'body', LEFT(NEW.content, 100),
            'url', '/avisos'
        )
    );

    RETURN NEW;
END;
$$;

-- Trigger: quando um aviso é inserido
DROP TRIGGER IF EXISTS on_announcement_push ON public.announcements;
CREATE TRIGGER on_announcement_push
    AFTER INSERT ON public.announcements
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_push_on_announcement();

-- ============================================================
-- FUNÇÃO: Notificar admin/professor quando novo atleta precisa de validação
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_push_on_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1);
    service_role_key TEXT := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1);
    target_payload JSONB;
BEGIN
    -- Só disparar quando needs_validation acabou de ser definido como TRUE
    IF NEW.needs_validation = TRUE AND (OLD IS NULL OR OLD.needs_validation IS DISTINCT FROM TRUE) THEN
        -- Target: notificar os responsáveis da escola do atleta, ou todos os admins
        IF NEW.school_id IS NOT NULL THEN
            target_payload := jsonb_build_object('school_id', NEW.school_id);
        ELSE
            target_payload := '"admins"'::jsonb;
        END IF;

        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := jsonb_build_object(
                'target', target_payload,
                'title', '✅ Nova Validação Pendente',
                'body', NEW.full_name || ' aguarda validação para entrar no tatame.',
                'url', '/admin/validacoes'
            )
        );
    END IF;

    RETURN NEW;
END;
$$;

-- Trigger: quando um perfil é criado OU atualizado com needs_validation = true
DROP TRIGGER IF EXISTS on_validation_push ON public.profiles;
CREATE TRIGGER on_validation_push
    AFTER INSERT OR UPDATE OF needs_validation ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_push_on_validation();

-- ============================================================
-- CONFIGURAR SECRETS NO VAULT DO SUPABASE
-- (Faz isto manualmente no Dashboard > Edge Functions > Secrets)
-- 
-- Os secrets necessários para a Edge Function "send-push-notification" são:
--   VAPID_PUBLIC_KEY  = BID9UnOd9TGqU_IG2ADLmUMOXHHX-3hoNJLLIhuhIo8GPMAEKNso-TXEqILHufy-Q
--   VAPID_PRIVATE_KEY = <o valor da chave privada do ficheiro vapid.json>
--   VAPID_SUBJECT     = mailto:zrteamcheck@gmail.com
--
-- Alternativamente, para usar o vault nas funções SQL acima, adiciona:
--   INSERT INTO vault.secrets (name, secret) VALUES ('supabase_url', 'https://cbbxlhdscqckqwuxbbuz.supabase.co');
--   INSERT INTO vault.secrets (name, secret) VALUES ('supabase_service_role_key', '<service_role_key>');
-- ============================================================
