-- ==============================================================================
-- 🥋 ZR TEAM APP — Tabela: external_events
-- Eventos externos (campeonatos, torneios, etc.) geridos pelo Admin.
-- ==============================================================================

-- 1. Criar tabela
CREATE TABLE IF NOT EXISTS public.external_events (
  id          uuid NOT NULL DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  event_date  date NOT NULL,
  link_url    text NOT NULL,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamp with time zone DEFAULT now(),
  CONSTRAINT external_events_pkey PRIMARY KEY (id)
);

-- 2. Ativar RLS
ALTER TABLE public.external_events ENABLE ROW LEVEL SECURITY;

-- 3. Leitura: qualquer utilizador autenticado pode ler eventos futuros
CREATE POLICY "external_events_select_authenticated"
ON public.external_events
FOR SELECT
USING (auth.role() = 'authenticated');

-- 4. Inserção: apenas Admin
CREATE POLICY "external_events_insert_admin"
ON public.external_events
FOR INSERT
WITH CHECK (
  public.get_my_role() = 'Admin'
);

-- 5. Atualização: apenas Admin
CREATE POLICY "external_events_update_admin"
ON public.external_events
FOR UPDATE
USING (public.get_my_role() = 'Admin');

-- 6. Eliminação: apenas Admin
CREATE POLICY "external_events_delete_admin"
ON public.external_events
FOR DELETE
USING (public.get_my_role() = 'Admin');

-- ==============================================================================
-- NOTA: A função get_my_role() deve existir (criada em fix_checkin_rls_crossschool.sql)
-- Se não existir, criá-la com:
-- CREATE OR REPLACE FUNCTION public.get_my_role()
-- RETURNS text AS $$
--   SELECT role FROM public.profiles WHERE id = auth.uid();
-- $$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;
-- ==============================================================================
