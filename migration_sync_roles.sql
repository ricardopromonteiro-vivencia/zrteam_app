-- 0. Atualizar o CHECK constraint da role para permitir 'Professor Responsável'
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('Atleta', 'Professor', 'Professor Responsável', 'Admin'));

-- 1. Actualizar perfis que são directores de escola (head_professor_id) para a role "Professor Responsável"
UPDATE public.profiles p
SET role = 'Professor Responsável'
FROM public.schools s
WHERE s.head_professor_id = p.id
AND p.role != 'Professor Responsável';

-- 2. Garantir que a política de leitura de professores inclui "Professor Responsável"
DROP POLICY IF EXISTS "Anyone can read Professor and Admin profiles" ON public.profiles;
CREATE POLICY "Anyone can read Professor and Admin profiles"
    ON public.profiles
    FOR SELECT
    USING (
        role IN ('Admin', 'Professor', 'Professor Responsável')
    );

-- 3. Inserir uma view para sincronizar a meta_data da conta Auth (Apenas os papéis Admin, Professor)
UPDATE auth.users u
SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{role}',
    to_jsonb(p.role)
)
FROM public.profiles p
WHERE u.id = p.id
AND COALESCE(raw_user_meta_data->>'role', '') != p.role;
