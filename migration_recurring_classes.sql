-- Adicionar coluna de recorrência à tabela classes
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE;

-- Reforçar Políticas RLS para garantir visibilidade restrita por escola
-- (Assumindo que as políticas anteriores podem precisar de ajuste ou clarificação)

-- Política para Atletas: Apenas ver aulas da sua escola ou aulas órfãs
DROP POLICY IF EXISTS "Atletas veem aulas da sua escola" ON public.classes;
CREATE POLICY "Atletas veem aulas da sua escola" ON public.classes
FOR SELECT TO authenticated
USING (
  school_id IS NULL OR 
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);

-- Política para Professores: Ver aulas da sua escola ou aulas órfãs
DROP POLICY IF EXISTS "Professores veem aulas da sua escola" ON public.classes;
CREATE POLICY "Professores veem aulas da sua escola" ON public.classes
FOR SELECT TO authenticated
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin' OR
  school_id IS NULL OR 
  school_id IN (SELECT school_id FROM public.profiles WHERE id = auth.uid())
);
