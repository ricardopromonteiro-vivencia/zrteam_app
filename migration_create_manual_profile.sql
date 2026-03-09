-- ==============================================================================
-- SCRIPT DE EMERGÊNCIA: Injetar Perfil Base Manualmente (Corrigido)
-- ==============================================================================
-- O erro anterior ocorreu porque a tua Base de Dados real (em produção)
-- não tem a coluna "nfc_uid" na tabela profiles, apesar dela constar
-- num backup antigo de código. Removi essa exigência!
-- ==============================================================================

DO $$ 
DECLARE 
  target_email text := 'danybbdazinha69@gmail.com'; -- <<<< COLOCA AQUI O EMAIL DA PESSOA (EM MINÚSCULAS)
  target_user_id uuid;
BEGIN
  -- 1. Encontrar o ID da pessoa na tabela Auth (usando ILIKE para ignorar maiúsculas/minúsculas)
  SELECT id INTO target_user_id FROM auth.users WHERE email ILIKE target_email;

  IF target_user_id IS NULL THEN
     RAISE NOTICE '❌ Nenhum utilizador encontrado com o email %', target_email;
     RETURN;
  END IF;

  -- 2. Verificar se a pessoa por acaso já tem perfil (para evitar erros de duplicado)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target_user_id) THEN
     RAISE NOTICE '⚠️ O utilizador % já tem um perfil na base de dados.', target_email;
     RETURN;
  END IF;

  -- 3. Injetar forçosamente o perfil base na tabela public.profiles
  INSERT INTO public.profiles (id, full_name, role, belt, is_archived)
  VALUES (
    target_user_id, 
    -- Usa o email vazio antes do @ como nome provisório
    split_part(target_email, '@', 1), 
    'Atleta', 
    'Branco', 
    false
  );

  RAISE NOTICE '✅ Perfil recuperado com sucesso! O Atleta % já vai aparecer na App.', target_email;
END $$;
