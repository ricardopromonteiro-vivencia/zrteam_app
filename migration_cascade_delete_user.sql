-- ==============================================================================
-- SCRIPT DE CORREÇÃO: Permitir a eliminação direta de utilizadores (Cascade Delete)
-- ==============================================================================
-- O erro "Database error deleting user" ao apagar no Supabase Auth acontece 
-- porque a tabela de perfis (public.profiles) tem uma ligação de segurança à tabela 
-- de Autenticação, mas falta-lhe a permissão de "reagir" a eliminações em cadeia.
-- 
-- Isto significa que mesmo que julgues que o perfil não existe, pode haver 
-- lá um registo "invisível" ou corrompido a bloquear a ação.
--
-- Este script resolve isso de forma permanente, configurando o "ON DELETE CASCADE".
-- ==============================================================================

DO $$ 
DECLARE 
  fk_constraint_name text;
BEGIN
  -- 1. Encontrar o nome da restrição (Foreign Key) original que liga o profile à auth.users
  SELECT tc.constraint_name INTO fk_constraint_name
  FROM information_schema.table_constraints AS tc 
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_schema = 'public'
    AND tc.table_name = 'profiles' 
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'id';

  -- 2. Apagar a restrição antiga (se existir)
  IF fk_constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || fk_constraint_name;
  END IF;

  -- 3. Criar a nova restrição com instrução "ON DELETE CASCADE"
  -- Assim, sempre que apagares o utilizador na Auth, o sistema apaga 
  -- automaticamente qualquer vestígio associado na base de dados!
  ALTER TABLE public.profiles
    ADD CONSTRAINT profiles_id_fkey
    FOREIGN KEY (id)
    REFERENCES auth.users(id)
    ON DELETE CASCADE;

END $$;
