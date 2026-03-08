-- ============================================================
-- FIX: Leitura Direta de Professores Atribuídos
-- Esta correção garante que qualquer atleta possa ver o nome 
-- do seu professor atribuído na "Área Pessoal", mesmo que a conta 
-- desse professor tenha ficado marcada como "Atleta" na BD!
-- ============================================================

-- 1. Criar uma função SECURITY DEFINER (bypassa o RLS) para descobrir quem é o professor, evitando recursão
CREATE OR REPLACE FUNCTION public.get_my_assigned_professor_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT assigned_professor_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 2. Permitir que o utilizador leia o perfil do professor que for devolvido por essa função
DROP POLICY IF EXISTS "Read assigned professor" ON public.profiles;
CREATE POLICY "Read assigned professor"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        id = public.get_my_assigned_professor_id()
    );
