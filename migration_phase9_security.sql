-- ============================================================
-- FASE 9: Migração de Segurança e Refinamentos
-- ============================================================

-- 1. Adicionar professor responsável a cada escola
ALTER TABLE public.schools
    ADD COLUMN IF NOT EXISTS head_professor_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2. (Opcional) Remover restrição NOT NULL em campos GPS que já não são usados
-- (Apenas execute se as colunas existirem e não forem usadas por RLS/functions)
-- ALTER TABLE public.schools ALTER COLUMN latitude DROP NOT NULL;
-- ALTER TABLE public.schools ALTER COLUMN longitude DROP NOT NULL;
-- ALTER TABLE public.schools ALTER COLUMN radius_meters DROP NOT NULL;

-- 3. Garantir RLS em class_bookings: professores só podem apagar bookings de atletas
-- da sua escola (ou bookings que eles mesmos tenham criado no check-in manual)
-- Nota: A validação principal é feita no frontend para simplificar.
-- Mas adicionamos policy para DELETE seguro.

-- Verificar se RLS está ativo
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

-- Policy: qualquer autenticado pode inserir a própria reserva
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_bookings' AND policyname = 'insert_own_booking') THEN
    CREATE POLICY insert_own_booking ON public.class_bookings
      FOR INSERT WITH CHECK (user_id = auth.uid() OR EXISTS (
        SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('Admin','Professor')
      ));
  END IF;
END $$;

-- Policy: Admin pode apagar qualquer booking; Professor pode apagar bookings da sua escola
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_bookings' AND policyname = 'delete_booking_by_role') THEN
    CREATE POLICY delete_booking_by_role ON public.class_bookings
      FOR DELETE USING (
        user_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Admin'
        )
        OR EXISTS (
          SELECT 1 FROM public.profiles p
          JOIN public.classes c ON c.id = class_bookings.class_id
          WHERE p.id = auth.uid() AND p.role = 'Professor'
            AND (p.school_id = c.school_id OR c.professor_id = p.id)
        )
      );
  END IF;
END $$;

-- Policy: SELECT aberto para autenticados (simplificado)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'class_bookings' AND policyname = 'select_bookings') THEN
    CREATE POLICY select_bookings ON public.class_bookings
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;
