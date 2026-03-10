-- ============================================================
-- MIGRATION: Triggers para notificações push automáticas
-- via Supabase Edge Function "send-push-notification"
-- 
-- PASSO 1 (obrigatório antes de correr este script):
--   Ativa pg_net no Supabase Dashboard > Database > Extensions > pg_net
--
-- PASSO 2: Corre este ficheiro no SQL Editor
-- ============================================================

-- Ativar extensão pg_net (necessária para chamadas HTTP a partir de SQL)
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;

-- ============================================================
-- FUNÇÃO: Notificar quando um novo AVISO é publicado
-- ============================================================
CREATE OR REPLACE FUNCTION public.notify_push_on_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    supabase_url TEXT := 'https://cbbxlhdscqckqwuxbbuz.supabase.co';
    service_role_key TEXT;
    target_payload JSONB;
    request_body TEXT;
BEGIN
    -- Ler service role key do vault
    BEGIN
        SELECT decrypted_secret INTO service_role_key
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
    END;

    IF service_role_key IS NULL THEN
        RETURN NEW;
    END IF;

    -- Definir target: escola específica ou todos
    IF NEW.school_id IS NOT NULL THEN
        target_payload := jsonb_build_object('school_id', NEW.school_id);
    ELSE
        target_payload := '"all"'::jsonb;
    END IF;

    request_body := jsonb_build_object(
        'target', target_payload,
        'title', '📢 Novo Aviso ZR Team',
        'body', LEFT(NEW.content, 100),
        'url', '/avisos'
    )::text;

    -- Chamar Edge Function via net.http_post (pg_net)
    BEGIN
        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := request_body::jsonb
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Push notification falhou (net.http_post): %', SQLERRM;
    END;

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
    supabase_url TEXT := 'https://cbbxlhdscqckqwuxbbuz.supabase.co';
    service_role_key TEXT;
    target_payload JSONB;
    request_body TEXT;
BEGIN
    -- Só disparar quando needs_validation acabou de ser definido como TRUE
    IF NOT (NEW.needs_validation = TRUE AND (OLD IS NULL OR OLD.needs_validation IS DISTINCT FROM TRUE)) THEN
        RETURN NEW;
    END IF;

    BEGIN
        SELECT decrypted_secret INTO service_role_key
        FROM vault.decrypted_secrets
        WHERE name = 'supabase_service_role_key'
        LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
        RETURN NEW;
    END;

    IF service_role_key IS NULL THEN
        RETURN NEW;
    END IF;

    IF NEW.school_id IS NOT NULL THEN
        target_payload := jsonb_build_object('school_id', NEW.school_id);
    ELSE
        target_payload := '"admins"'::jsonb;
    END IF;

    request_body := jsonb_build_object(
        'target', target_payload,
        'title', '✅ Nova Validação Pendente',
        'body', NEW.full_name || ' aguarda validação para entrar no tatame.',
        'url', '/admin/validacoes'
    )::text;

    -- Chamar Edge Function via net.http_post (pg_net)
    BEGIN
        PERFORM net.http_post(
            url := supabase_url || '/functions/v1/send-push-notification',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || service_role_key
            ),
            body := request_body::jsonb
        );
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Push notification falhou (net.http_post): %', SQLERRM;
    END;

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
-- CONFIGURAÇÃO DO VAULT (corre estas linhas uma vez para guardar
-- a service_role_key de forma segura no vault do Supabase):
--
-- SELECT vault.create_secret('supabase_service_role_key', '<COLE_AQUI_A_SERVICE_ROLE_KEY>');
--
-- Podes ver a chave em: Supabase Dashboard > Project Settings > API > service_role key
-- ============================================================
