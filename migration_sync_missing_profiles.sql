-- ==============================================================================
-- SCRIPT DE EMERGÊNCIA: Sincronizar utilizadores sem perfil
-- ==============================================================================
-- Este script procura por contas que se registaram na tabela segura 'auth.users'
-- mas cujo gatilho (trigger) falhou por lgum motivo (ex: falhas de net momentâneas) 
-- e não criou a entrada na 'public.profiles'.
-- ==============================================================================

INSERT INTO public.profiles (id, full_name, role, belt, created_at, is_archived)
SELECT 
    au.id, 
    -- Tenta extrair o nome dos metadados, ou usa a primeira parte do email se não existir
    COALESCE(au.raw_user_meta_data->>'full_name', split_part(au.email, 'Danybbdazinha69@gmail.com', 1)), 
    'Atleta', -- Assume o papel padrão
    'Branco', -- Assume a faixa padrão
    au.created_at,
    false
FROM auth.users au
LEFT JOIN public.profiles p ON au.id = p.id
WHERE p.id IS NULL;
