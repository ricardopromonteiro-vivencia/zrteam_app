-- ==============================================================================
-- SCRIPT DE EMERGÊNCIA: Eliminar "Conta Fantasma" (Hard Delete)
-- ==============================================================================
-- Quando a interface do Supabase recusa apagar um utilizador devido a Foreign Keys
-- em tabelas escondidas ou do teu próprio esquema, a única solução é forçar a limpeza.
-- Este script faz um varrimento de segurança e apaga todos os vestígios da conta.
-- ==============================================================================

-- ⚠️ INSTRUÇÃO MÁXIMA: SUBSTITUI O EMAIL ABAIXO PELO EMAIL DO ATLETA ENCRAVADO
DO $$ 
DECLARE 
  target_email text := 'EMAIL_DO_ATLETA@AQUI.COM'; -- <<<< MUDA AQUI
  target_user_id uuid;
BEGIN
  -- 1. Descobrir o ID da conta usando o email
  SELECT id INTO target_user_id FROM auth.users WHERE email = target_email;

  IF target_user_id IS NULL THEN
     RAISE NOTICE 'Nenhum utilizador encontrado com o email %', target_email;
     RETURN;
  END IF;

  RAISE NOTICE 'Iniciando purga da conta Fantasma: % (ID: %)', target_email, target_user_id;

  -- 2. Limpar todas as tabelas da Aplicação Jiu-Jitsu que possam ter o ID pendurado
  DELETE FROM public.class_bookings WHERE user_id = target_user_id;
  DELETE FROM public.checkin_logs WHERE user_id = target_user_id;
  DELETE FROM public.belt_history WHERE user_id = target_user_id;
  DELETE FROM public.payments WHERE user_id = target_user_id;
  DELETE FROM public.notifications WHERE user_id = target_user_id;
  DELETE FROM public.announcements WHERE author_id = target_user_id;
  DELETE FROM public.classes WHERE professor_id = target_user_id;
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- 3. Limpar tabelas internas e escondidas do próprio Supabase (Sistema Auth)
  DELETE FROM auth.identities WHERE user_id = target_user_id;
  DELETE FROM auth.sessions WHERE user_id = target_user_id;
  DELETE FROM auth.refresh_tokens WHERE user_id = target_user_id;
  DELETE FROM auth.mfa_factors WHERE user_id = target_user_id;
  DELETE FROM auth.mfa_challenges WHERE factor_id IN (SELECT id FROM auth.mfa_factors WHERE user_id = target_user_id);
  DELETE FROM auth.mfa_amr_claims WHERE session_id IN (SELECT id FROM auth.sessions WHERE user_id = target_user_id);
  
  -- 4. O Golpe Final: Apagar o utilizador da Autenticação pura
  DELETE FROM auth.users WHERE id = target_user_id;

  RAISE NOTICE 'Conta apagada com sucesso! O utilizador já pode fazer um novo registo limpo.';
END $$;
