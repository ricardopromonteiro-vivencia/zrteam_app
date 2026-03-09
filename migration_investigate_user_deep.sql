-- ==============================================================================
-- SCRIPT DE INVESTIGAÇÃO SUPERIOR: À procura da conta perdida
-- ==============================================================================
-- Se não apaga nem deixa criar, existe um bloqueio algures na Base de Dados.
-- Vamos procurar em TOTAS as tabelas do Supabase (sistema e aplicação) 
-- para diagnosticar onde está a conta que ficou pendurada.
-- O output deverá aparecer na janela de "Results" ou "Messages" do Supabase.
-- ==============================================================================

DO $$ 
DECLARE 
  target_email text := 'Danybbdazinha69@gmail.com'; -- <<<< MUDA AQUI
  target_user_id uuid;
  found_count integer;
BEGIN
  -- 1. Existe na Autenticação?
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;
  
  IF target_user_id IS NULL THEN
     RAISE EXCEPTION 'O email % não existe na tabela auth.users. Tens a certeza que o email está correto?', target_email;
  END IF;

  RAISE NOTICE '==================================================';
  RAISE NOTICE '🔎 RESULTADOS PARA O EMAIL: %', target_email;
  RAISE NOTICE '🔑 UUID DA CONTA: %', target_user_id;
  RAISE NOTICE '==================================================';

  -- 2. Verificar Perfis
  SELECT count(*) INTO found_count FROM public.profiles WHERE id = target_user_id;
  RAISE NOTICE 'Tabela public.profiles: % registo(s) encontrado(s)', found_count;

  -- 3. Verificar Aulas Dinâmicas
  SELECT count(*) INTO found_count FROM public.class_bookings WHERE user_id = target_user_id;
  RAISE NOTICE 'Tabela public.class_bookings: % registo(s) encontrado(s)', found_count;

  -- 4. Verificar Identidades (Logins Google/Facebook etc)
  SELECT count(*) INTO found_count FROM auth.identities WHERE user_id = target_user_id;
  RAISE NOTICE 'Tabela auth.identities: % registo(s) encontrado(s)', found_count;

  -- 5. Verificar Sessões presas
  SELECT count(*) INTO found_count FROM auth.sessions WHERE user_id = target_user_id;
  RAISE NOTICE 'Tabela auth.sessions: % registo(s) encontrado(s)', found_count;

  -- 6. Verificar MFA
  SELECT count(*) INTO found_count FROM auth.mfa_factors WHERE user_id = target_user_id;
  RAISE NOTICE 'Tabela auth.mfa_factors: % registo(s) encontrado(s)', found_count;

  RAISE NOTICE '==================================================';
  RAISE NOTICE 'Se alguma das tabelas acima disser "1 registo encontrado" (com exceção das identities/sessions), é esse o bloqueio!';
END $$;
