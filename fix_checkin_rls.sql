-- ==============================================================================
-- 🥋 CORREÇÃO: RLS class_bookings — Permitir check-in por Professores
-- Problema: Professores fazem UPDATE e INSERT direto em class_bookings,
-- mas as políticas RLS podem não contemplar esses papéis.
-- ==============================================================================

-- Garantir que RLS está ativa na tabela
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

-- Limpar políticas antigas E novas (para ser idempotente)
DROP POLICY IF EXISTS "Utilizadores veem as suas marcações" ON public.class_bookings;
DROP POLICY IF EXISTS "Utilizadores inscrevem-se" ON public.class_bookings;
DROP POLICY IF EXISTS "Professores gerem check-ins da sua escola" ON public.class_bookings;
DROP POLICY IF EXISTS "Admin faz tudo em class_bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Profs update bookings escola" ON public.class_bookings;
DROP POLICY IF EXISTS "Profs insert bookings escola" ON public.class_bookings;
DROP POLICY IF EXISTS "Profs delete bookings escola" ON public.class_bookings;
DROP POLICY IF EXISTS "Users select own bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Users insert own bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Users update own bookings" ON public.class_bookings;
DROP POLICY IF EXISTS "Users delete own bookings" ON public.class_bookings;
-- Nomes novos (caso este script já tenha sido corrido antes)
DROP POLICY IF EXISTS "cb_user_select_own" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_prof_select_school" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_admin_select_all" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_user_insert_own" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_prof_insert_school" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_admin_insert" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_user_update_own" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_prof_update_school" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_admin_update" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_user_delete_own" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_prof_delete_school" ON public.class_bookings;
DROP POLICY IF EXISTS "cb_admin_delete" ON public.class_bookings;

-- ─── SELECT ───────────────────────────────────────────────────────────────────

-- Atletas veem as próprias marcações
CREATE POLICY "cb_user_select_own"
ON public.class_bookings FOR SELECT
USING (auth.uid() = user_id);

-- Professores e Prof. Responsável veem as marcações das aulas da sua escola
CREATE POLICY "cb_prof_select_school"
ON public.class_bookings FOR SELECT
USING (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_id
          AND c.school_id = public.get_auth_school_id()
    )
);

-- Admin vê tudo
CREATE POLICY "cb_admin_select_all"
ON public.class_bookings FOR SELECT
USING (public.get_auth_role() = 'Admin');

-- ─── INSERT ───────────────────────────────────────────────────────────────────

-- Atletas inscrevem-se a si próprios
CREATE POLICY "cb_user_insert_own"
ON public.class_bookings FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Professores inscrevem atletas da própria escola (check-in rápido)
CREATE POLICY "cb_prof_insert_school"
ON public.class_bookings FOR INSERT
WITH CHECK (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_id
          AND c.school_id = public.get_auth_school_id()
    )
);

-- Admin insere qualquer
CREATE POLICY "cb_admin_insert"
ON public.class_bookings FOR INSERT
WITH CHECK (public.get_auth_role() = 'Admin');

-- ─── UPDATE ───────────────────────────────────────────────────────────────────

-- Atletas atualizam as próprias marcações (auto check-in QR)
CREATE POLICY "cb_user_update_own"
ON public.class_bookings FOR UPDATE
USING (auth.uid() = user_id);

-- Professores fazem UPDATE no status (check-in manual / penalizações)
-- nas aulas da própria escola
CREATE POLICY "cb_prof_update_school"
ON public.class_bookings FOR UPDATE
USING (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_id
          AND c.school_id = public.get_auth_school_id()
    )
);

-- Admin atualiza tudo
CREATE POLICY "cb_admin_update"
ON public.class_bookings FOR UPDATE
USING (public.get_auth_role() = 'Admin');

-- ─── DELETE ───────────────────────────────────────────────────────────────────

-- Atletas apagam as próprias marcações
CREATE POLICY "cb_user_delete_own"
ON public.class_bookings FOR DELETE
USING (auth.uid() = user_id);

-- Professores removem marcações das aulas da própria escola
CREATE POLICY "cb_prof_delete_school"
ON public.class_bookings FOR DELETE
USING (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_id
          AND c.school_id = public.get_auth_school_id()
    )
);

-- Admin apaga tudo
CREATE POLICY "cb_admin_delete"
ON public.class_bookings FOR DELETE
USING (public.get_auth_role() = 'Admin');
