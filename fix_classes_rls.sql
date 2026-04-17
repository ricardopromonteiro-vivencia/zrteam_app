-- ==============================================================================
-- 🥋 ZR TEAM — FIX: RLS Tabela CLASSES (criação de aulas)
-- ATENÇÃO: este script é sobre a tabela CLASSES (criar/editar/apagar AULAS),
--          NÃO sobre class_bookings (check-in), que tem o seu próprio fix.
--
-- Regras:
--   - Admin: cria/edita/apaga aulas em QUALQUER escola
--   - Professor Responsável: cria/edita/apaga APENAS na SUA escola
--   - Professor simples, Atleta: apenas leitura (sem gestão de aulas)
--
-- Usa get_my_role() — função confirmada existir na BD.
-- Usa subquery directa para school_id (sem depender de função auxiliar).
-- ==============================================================================

-- ==============================================================================
-- 1. REMOVER as políticas problemáticas que davam acesso indevido a Professores
-- ==============================================================================
DROP POLICY IF EXISTS "Only professors and admins can manage classes" ON public.classes;
DROP POLICY IF EXISTS "Professores e Admin podem criar/editar aulas" ON public.classes;

-- ==============================================================================
-- 2. Remover também as do nosso script anterior (para ser idempotente)
-- ==============================================================================
DROP POLICY IF EXISTS "classes_insert_admin" ON public.classes;
DROP POLICY IF EXISTS "classes_insert_prof_resp" ON public.classes;
DROP POLICY IF EXISTS "classes_update_admin" ON public.classes;
DROP POLICY IF EXISTS "classes_update_prof_resp" ON public.classes;
DROP POLICY IF EXISTS "classes_delete_admin" ON public.classes;
DROP POLICY IF EXISTS "classes_delete_prof_resp" ON public.classes;

-- ==============================================================================
-- 3. INSERT — apenas Admin (qualquer escola) e Professor Responsável (sua escola)
-- ==============================================================================

CREATE POLICY "classes_insert_admin"
ON public.classes
FOR INSERT
WITH CHECK (
    get_my_role() = 'Admin'
);

CREATE POLICY "classes_insert_prof_resp"
ON public.classes
FOR INSERT
WITH CHECK (
    get_my_role() = 'Professor Responsável'
    AND school_id = (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- ==============================================================================
-- 4. UPDATE — apenas Admin (qualquer escola) e Professor Responsável (sua escola)
-- ==============================================================================

CREATE POLICY "classes_update_admin"
ON public.classes
FOR UPDATE
USING (get_my_role() = 'Admin');

CREATE POLICY "classes_update_prof_resp"
ON public.classes
FOR UPDATE
USING (
    get_my_role() = 'Professor Responsável'
    AND school_id = (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- ==============================================================================
-- 5. DELETE — apenas Admin (qualquer escola) e Professor Responsável (sua escola)
-- ==============================================================================

CREATE POLICY "classes_delete_admin"
ON public.classes
FOR DELETE
USING (get_my_role() = 'Admin');

CREATE POLICY "classes_delete_prof_resp"
ON public.classes
FOR DELETE
USING (
    get_my_role() = 'Professor Responsável'
    AND school_id = (
        SELECT school_id FROM public.profiles WHERE id = auth.uid()
    )
);

-- ==============================================================================
-- 6. SELECT — as políticas existentes são mantidas (não as tocamos)
-- Já existem e estão corretas:
--   "All authenticated can read classes"
--   "Atletas veem aulas da sua escola"
--   "Professores veem aulas da sua escola"
--   "Todos podem ver as aulas (autenticados)"
-- ==============================================================================

-- ==============================================================================
-- 7. VERIFICAÇÃO FINAL — confirmar o estado das políticas após o fix
-- ==============================================================================
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'classes'
ORDER BY cmd, policyname;
