-- ==============================================================================
-- 🏋️ SELF CHECK-IN PARA PROFESSORES E ADMINS
-- Permite que professores, professores responsáveis e admins façam:
--   1. Marcação numa aula (class_bookings) para eles próprios
--   2. Check-in na aula (status = 'Presente')
--   3. Contabilização automática via increment_attended_classes
--
-- NOTA: A função increment_attended_classes já funciona para qualquer role —
-- só emite notificações de faixa para 'Atleta'. Para professores incrementa
-- o contador attended_classes normalmente.
--
-- Este script verifica as políticas RLS existentes e garante que:
--   - Professores podem inserir class_bookings para si próprios
--   - Professores podem atualizar o status das suas próprias bookings
-- ==============================================================================

-- Verificar as políticas atuais da tabela class_bookings:
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'class_bookings'
ORDER BY cmd, policyname;

-- ==============================================================================
-- Se não existir política de INSERT/UPDATE/DELETE para utilizadores autenticados,
-- descomenta e executa o bloco abaixo:
-- ==============================================================================
/*
-- Política de INSERT: qualquer utilizador autenticado pode inscrever-se (incluindo professores)
CREATE POLICY "Utilizadores autenticados podem inscrever-se nas aulas"
ON public.class_bookings
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- Política de UPDATE: utilizadores podem atualizar as suas próprias bookings
-- (professores usam isto para fazer check-in próprio)
CREATE POLICY "Utilizadores podem atualizar as suas bookings"
ON public.class_bookings
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Política de DELETE: utilizadores podem cancelar as suas próprias inscrições
CREATE POLICY "Utilizadores podem cancelar as suas inscrições"
ON public.class_bookings
FOR DELETE
TO authenticated
USING (user_id = auth.uid());
*/
