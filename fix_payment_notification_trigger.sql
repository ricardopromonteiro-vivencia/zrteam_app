-- ==============================================================================
-- FIX: notify_push_on_announcement — respeitar target_user_id em avisos privados
-- Problema: O trigger ignorava o target_user_id e enviava push para todos os
--           gestores da escola quando um aviso de pagamento era criado por atleta.
-- Solução: Se o aviso tiver target_user_id, enviar push APENAS para esse utilizador.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.notify_push_on_announcement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  supabase_url TEXT := 'https://cbbxlhdscqckqwuxbbuz.supabase.co';
  service_role_key TEXT;
  target_payload JSONB;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF service_role_key IS NULL THEN RETURN NEW; END IF;

  -- ✅ CORREÇÃO: avisos privados (ex: lembretes de pagamento) só
  --    notificam o utilizador visado — NÃO os gestores/admin.
  IF NEW.target_user_id IS NOT NULL THEN
    -- Aviso privado → push apenas para o destinatário
    target_payload := jsonb_build_object('user_id', NEW.target_user_id);
  ELSIF NEW.school_id IS NOT NULL THEN
    -- Aviso público de escola → push para gestores da escola
    target_payload := jsonb_build_object('school_id', NEW.school_id);
  ELSE
    -- Aviso global → push para todos
    target_payload := '"all"'::jsonb;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'target', target_payload,
        'title',  NEW.title,
        'body',   LEFT(NEW.content, 100),
        'url',    '/avisos'
      )::text::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Push falhou: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$;
