-- Adicionar coluna email à tabela profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;

-- Função para atualizar o trigger e incluir o email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, school_id, date_of_birth, belt, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', new.email, 'Utilizador'),
    COALESCE(new.raw_user_meta_data->>'role', 'Atleta'),
    (new.raw_user_meta_data->>'school_id')::uuid,
    (new.raw_user_meta_data->>'date_of_birth')::date,
    COALESCE(new.raw_user_meta_data->>'belt', 'Branco'),
    new.email
  );
  RETURN new;
END;
$$;

-- Tentar preencher emails existentes na tabela profiles (requer acesso a auth.users via SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.sync_existing_emails()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  UPDATE public.profiles p
  SET email = u.email
  FROM auth.users u
  WHERE p.id = u.id AND p.email IS NULL;
END;
$$;

SELECT public.sync_existing_emails();
DROP FUNCTION public.sync_existing_emails();
