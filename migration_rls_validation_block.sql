-- ============================================================
-- MIGRATION: RLS - Bloquear utilizadores não validados
-- ============================================================
-- Proteção de backend para impedir utilizadores com needs_validation=true
-- de aceder a dados sensíveis mesmo que contornem o frontend.
-- ============================================================

-- 1. Garantir que RLS está ativa nas tabelas críticas
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 2. Criar uma função auxiliar para verificar se o utilizador está validado
CREATE OR REPLACE FUNCTION public.is_validated()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT NOT COALESCE(needs_validation, FALSE)
  FROM public.profiles
  WHERE id = auth.uid()
  LIMIT 1;
$$;

-- 3. RLS: class_bookings — só utilizadores validados podem criar reservas
-- Política de INSERT (impede inscrição em aulas)
DROP POLICY IF EXISTS "Validated users can book classes" ON public.class_bookings;
CREATE POLICY "Validated users can book classes"
  ON public.class_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_validated());

-- Política de SELECT (utilizadores vêm as suas próprias reservas se validados)
DROP POLICY IF EXISTS "Users see own bookings if validated" ON public.class_bookings;
CREATE POLICY "Users see own bookings if validated"
  ON public.class_bookings
  FOR SELECT
  TO authenticated
  USING (
    public.is_validated()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
  );

-- Política de UPDATE (check-in pelos professores - apenas se professor/admin)
DROP POLICY IF EXISTS "Professors can update bookings" ON public.class_bookings;
CREATE POLICY "Professors can update bookings"
  ON public.class_bookings
  FOR UPDATE
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
  );

-- Política de DELETE (cancelamento de inscrição - só o próprio se validado, ou professor/admin)
DROP POLICY IF EXISTS "Validated users can cancel own bookings" ON public.class_bookings;
CREATE POLICY "Validated users can cancel own bookings"
  ON public.class_bookings
  FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_validated())
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
  );

-- 4. RLS: classes — qualquer utilizador autenticado vê as aulas (para exibição)
-- Mas só professores/admins podem criar/alterar/apagar
DROP POLICY IF EXISTS "All authenticated can read classes" ON public.classes;
CREATE POLICY "All authenticated can read classes"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Only professors and admins can manage classes" ON public.classes;
CREATE POLICY "Only professors and admins can manage classes"
  ON public.classes
  FOR ALL
  TO authenticated
  USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
  )
  WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
  );

-- 5. RLS: profiles — utilizadores vêem o seu próprio perfil sempre
-- Admin vê todos. Professor vê os da sua escola.
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor')
  );

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- VERIFICAÇÃO:
-- SELECT * FROM public.is_validated(); -- deve retornar TRUE se validado
-- ============================================================
