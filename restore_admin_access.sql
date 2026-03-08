-- 1. Este comando restaura o teu estatuto de 'Admin'
-- Ele procura qualquer utilizador que tenha 'Ricardo' no nome e devolve-lhe o trono.
-- Se o teu nome na base de dados for diferente, altera o '%Ricardo%' abaixo (mantém a % !!)
UPDATE public.profiles
SET role = 'Admin'
WHERE full_name ILIKE '%Ricardo%';

-- 2. Sincronizar o sistema de Auth oculto do Supabase para ele saber que falas a sério
UPDATE auth.users u
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    '"Admin"'
)
FROM public.profiles p
WHERE u.id = p.id
AND p.role = 'Admin';
