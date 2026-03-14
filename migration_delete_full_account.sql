-- Migration: Apagar conta completa (profiles + auth.users)
-- Esta migration atualiza a função delete_own_user para também apagar
-- o utilizador da tabela auth.users (autenticação), garantindo limpeza total.
--
-- COMO USAR: Corre este ficheiro no Supabase SQL Editor.

CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Apagar perfil e todos os dados relacionados (cascade: bookings, pagamentos, push_subscriptions, etc.)
  DELETE FROM public.profiles WHERE id = v_uid;
  -- Apagar o utilizador da autenticação (auth.users)
  -- SECURITY DEFINER corre como postgres (superuser) que tem acesso ao schema auth
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, auth;
