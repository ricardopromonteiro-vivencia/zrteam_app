-- ==============================================================================
-- 🥋 CORREÇÃO: Visibilidade de Perfis para Marcações Multi-Escola
-- Objetivo: Permitir que atletas vejam o nome dos professores de outras escolas
-- e que vejam quem mais está inscrito nas mesmas aulas que eles.
-- ==============================================================================

-- 1. Permitir que QUALQUER utilizador autenticado veja informações básicas de Staff
-- (Essencial para ver quem dá a aula na lista de aulas de outra escola)
DROP POLICY IF EXISTS "RLS_PROFILES_PUBLIC_STAFF" ON public.profiles;
CREATE POLICY "RLS_PROFILES_PUBLIC_STAFF"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  role IN ('Professor', 'Professor Responsável', 'Admin')
  AND is_archived = false
  AND is_hidden = false
);

-- 2. Permitir que utilizadores vejam informações básicas de colegas de turma
-- (Para que a funcionalidade "Ver Inscritos" funcione para todos)
DROP POLICY IF EXISTS "RLS_PROFILES_VIEW_CLASSMATES" ON public.profiles;
CREATE POLICY "RLS_PROFILES_VIEW_CLASSMATES"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.class_bookings cb1
    WHERE cb1.user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.class_bookings cb2
      WHERE cb2.class_id = cb1.class_id
      AND cb2.user_id = profiles.id
    )
  )
  AND is_archived = false
  AND is_hidden = false
);

-- 3. Garantir que a política geral de pesquisa para STAFF continua válida
-- (Já existe em fix_profiles_recursion.sql, mas reforçamos aqui se necessário)
-- DROP POLICY IF EXISTS "RLS_PROFILES_CROSS_SCHOOL_SELECT" ON public.profiles;
-- (Mantemos a que lá está pois já é restritiva apenas para staff)

-- ==============================================================================
-- VERIFICAÇÃO:
-- Um atleta agora deve conseguir ver o professor de qualquer aula no sistema.
-- ==============================================================================
