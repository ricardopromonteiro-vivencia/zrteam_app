-- ==============================================================================
-- 🚨 EMERGÊNCIA — Corrigir recursão infinita na policy de profiles
-- Causa: a policy criada anteriormente fazia SELECT em profiles dentro
-- de uma policy de profiles → loop infinito.
-- ==============================================================================

-- PASSO 1: Remover imediatamente a policy problemática
DROP POLICY IF EXISTS "Professor can read all athlete profiles for checkin" ON public.profiles;

-- PASSO 2: Criar função auxiliar com SECURITY DEFINER
-- Esta função corre como superuser, fora do RLS, evitando a recursão.
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS text AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- PASSO 3: Recriar a policy usando a função (sem recursão)
CREATE POLICY "Professor can read all athlete profiles for checkin"
ON public.profiles
FOR SELECT
USING (
  public.get_my_role() IN ('Professor', 'Professor Responsável')
  AND (
    (is_archived = false AND is_hidden = false)
    OR role IN ('Professor', 'Professor Responsável', 'Admin')
  )
);

-- ==============================================================================
-- VERIFICAÇÃO: testa se a função funciona (deve devolver o teu role)
-- SELECT public.get_my_role();
-- ==============================================================================
