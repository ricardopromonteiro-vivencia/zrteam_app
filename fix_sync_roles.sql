-- ==============================================================================
-- 🥋 FIX ROLE SYNC - Corrigir RLS para Francisco e outros Admins
-- ==============================================================================

-- 1. Sincronizar todos os perfis atuais para o auth.users
-- Isto resolve IMEDIATAMENTE o problema do Francisco não conseguir ver os Atletas
DO $$
DECLARE
  prof RECORD;
BEGIN
  FOR prof IN SELECT id, role, school_id FROM public.profiles LOOP
    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
          jsonb_set(
              COALESCE(raw_user_meta_data, '{}'::jsonb),
              '{role}',
              to_jsonb(prof.role)
          ),
          '{school_id}',
          to_jsonb(prof.school_id)
        )
    WHERE id = prof.id;
  END LOOP;
END;
$$;

-- 2. Modificar o get_auth_role() para ser case-insensitive just in case
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = auth, public
AS $$
  SELECT 
    CASE 
      WHEN UPPER(COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role'),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      )) = 'ADMIN' THEN 'Admin'
      WHEN UPPER(COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role'),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      )) = 'PROFESSOR' THEN 'Professor'
      WHEN UPPER(COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role'),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      )) = 'PROFESSOR RESPONSÁVEL' THEN 'Professor Responsável'
      WHEN UPPER(COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role'),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      )) = 'ATLETA' THEN 'Atleta'
      ELSE COALESCE(
        (auth.jwt() -> 'user_metadata' ->> 'role'),
        (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
      )
    END;
$$;

-- 3. Criar função para manter tudo sempre sincronizado no futuro
CREATE OR REPLACE FUNCTION public.sync_profile_to_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
        jsonb_set(
            COALESCE(raw_user_meta_data, '{}'::jsonb),
            '{role}',
            to_jsonb(NEW.role)
        ),
        '{school_id}',
        to_jsonb(NEW.school_id)
      )
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

-- 4. Adicionar o Trigger Automático
DROP TRIGGER IF EXISTS on_profile_update_sync_auth ON public.profiles;
CREATE TRIGGER on_profile_update_sync_auth
AFTER UPDATE OF role, school_id ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_profile_to_auth();
