-- ============================================================
-- CORREÇÃO DE EMERGÊNCIA: Remover recursão infinita no RLS
-- Corre este script AGORA no SQL Editor do Supabase
-- ============================================================

-- 1. Remover TODAS as políticas problemáticas que causaram recursão
DROP POLICY IF EXISTS "Users can read own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Validated users can book classes" ON public.class_bookings;
DROP POLICY IF EXISTS "Users see own bookings if validated" ON public.class_bookings;
DROP POLICY IF EXISTS "Professors can update bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Validated users can cancel own bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "All authenticated can read classes" ON public.classes;
DROP POLICY IF EXISTS "Only professors and admins can manage classes" ON public.classes;

-- 2. Criar função auxiliar SECURITY DEFINER para obter o role
--    (bypassa o RLS, evitando recursão)
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 3. Recriar a função is_validated sem recursão
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

-- 4. Políticas profiles (sem recursão - usam get_my_role())
CREATE POLICY "Users can read own profile"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = auth.uid()
    OR public.get_my_role() IN ('Admin', 'Professor')
  );

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 5. Políticas class_bookings
CREATE POLICY "Validated users can book classes"
  ON public.class_bookings
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_validated());

CREATE POLICY "Users see own bookings if validated"
  ON public.class_bookings
  FOR SELECT
  TO authenticated
  USING (
    public.is_validated()
    OR public.get_my_role() IN ('Admin', 'Professor')
  );

CREATE POLICY "Professors can update bookings"
  ON public.class_bookings
  FOR UPDATE
  TO authenticated
  USING (public.get_my_role() IN ('Admin', 'Professor'));

CREATE POLICY "Validated users can cancel own bookings"
  ON public.class_bookings
  FOR DELETE
  TO authenticated
  USING (
    (user_id = auth.uid() AND public.is_validated())
    OR public.get_my_role() IN ('Admin', 'Professor')
  );

-- 6. Políticas classes
CREATE POLICY "All authenticated can read classes"
  ON public.classes
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only professors and admins can manage classes"
  ON public.classes
  FOR ALL
  TO authenticated
  USING (public.get_my_role() IN ('Admin', 'Professor'))
  WITH CHECK (public.get_my_role() IN ('Admin', 'Professor'));

-- ============================================================
-- Após correr, tenta fazer login novamente.
-- ============================================================
