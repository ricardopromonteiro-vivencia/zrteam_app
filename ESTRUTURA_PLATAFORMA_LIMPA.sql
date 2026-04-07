-- ==============================================================================
-- 🥋 ZR TEAM APP — ESTRUTURA COMPLETA DA BASE DE DADOS (LIMPA / SEM DADOS)
-- Última atualização: 2026-03-14
-- Schema real obtido via Supabase Schema Visualizer + funções e triggers da app.
--
-- Changelog:
--   2026-03-12  Schema base exportado do Supabase
--   2026-03-13  + monthly_goal (profiles) — objetivo mensal do atleta/professor
--   2026-03-14  + is_hidden (profiles) — utilizador fantasma/invisível nas listas
--   2026-03-14  ~ delete_own_user — agora apaga também de auth.users
--   2026-03-14  ~ get_absent_athletes — excluí utilizadores com is_hidden = true
--
-- COMO USAR:
--   1. Cria um novo projeto no Supabase.
--   2. Vai ao SQL Editor e corre este ficheiro.
--   3. Ativa as extensões: pg_net, pg_cron no Dashboard → Database → Extensions.
--   4. Corre: SELECT vault.create_secret('supabase_service_role_key','<TUA_KEY>');
--   5. Faz deploy da Edge Function "send-push-notification".
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- ==============================================================================
-- 2. TABELAS (schema real — exportado do Supabase Schema Visualizer)
-- ==============================================================================

-- 2.1 Escolas
CREATE TABLE public.schools (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamp with time zone DEFAULT now(),
  head_professor_id uuid,              -- Referência a profiles (adicionada depois)
  order_index integer DEFAULT 99,      -- Ordem de prioridade nos menus
  CONSTRAINT schools_pkey PRIMARY KEY (id)
);
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

-- 2.2 Perfis de Utilizador (ligados ao auth.users)
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'Atleta'::text CHECK (role = ANY (ARRAY[
    'Atleta'::text, 'Professor'::text, 'Professor Responsável'::text, 'Admin'::text
  ])),
  belt text NOT NULL DEFAULT 'Branco'::text CHECK (belt = ANY (ARRAY[
    'Cinza/ branco'::text, 'Cinza'::text, 'Cinza/ Preto'::text,
    'Amarelo / Branco'::text, 'Amarelo'::text, 'Amarelo/ preto'::text,
    'Laranja/ Branco'::text, 'Laranja'::text, 'Laranja/ preto'::text,
    'Verde / Branco'::text, 'Verde'::text, 'Verde / Preto'::text,
    'Branco'::text, 'Azul'::text, 'Roxo'::text, 'Marrom'::text, 'Preto'::text
  ])),
  degrees integer NOT NULL DEFAULT 0,
  attended_classes integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  school_id uuid,
  date_of_birth date,
  assigned_professor_id uuid,          -- Professor atribuído ao atleta
  email text,                          -- Email para referência rápida
  is_archived boolean NOT NULL DEFAULT false,
  needs_validation boolean NOT NULL DEFAULT false,  -- Atleta novo aguarda validação
  is_global_professor boolean DEFAULT false,         -- Professor pode dar aulas em qualquer escola
  monthly_goal integer DEFAULT NULL,                 -- Objetivo mensal de aulas (definido pelo próprio atleta)
  is_hidden boolean DEFAULT false,                   -- Utilizador invisível/fantasma (não aparece em nenhuma lista)
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT profiles_assigned_professor_id_fkey FOREIGN KEY (assigned_professor_id) REFERENCES public.profiles(id)
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Referência circular schools → profiles (head_professor)
ALTER TABLE public.schools
  ADD CONSTRAINT schools_head_professor_id_fkey
  FOREIGN KEY (head_professor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 2.3 Aulas
CREATE TABLE public.classes (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  title text NOT NULL,
  date date NOT NULL,
  start_time time without time zone NOT NULL,
  end_time time without time zone NOT NULL,
  capacity integer NOT NULL DEFAULT 30,
  professor_id uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  school_id uuid,
  is_recurring boolean DEFAULT false,
  second_professor_id uuid,            -- Professor auxiliar (opcional)
  CONSTRAINT classes_pkey PRIMARY KEY (id),
  CONSTRAINT classes_professor_id_fkey FOREIGN KEY (professor_id) REFERENCES public.profiles(id),
  CONSTRAINT classes_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id),
  CONSTRAINT classes_second_professor_id_fkey FOREIGN KEY (second_professor_id) REFERENCES public.profiles(id)
);
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

-- 2.4 Reservas / Presenças
CREATE TABLE public.class_bookings (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  class_id uuid NOT NULL,
  user_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'Marcado'::text CHECK (status = ANY (ARRAY[
    'Marcado'::text, 'Presente'::text, 'Falta'::text
  ])),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(class_id, user_id),
  CONSTRAINT class_bookings_pkey PRIMARY KEY (id),
  CONSTRAINT class_bookings_class_id_fkey FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE CASCADE,
  CONSTRAINT class_bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;

-- 2.5 Avisos / Notícias
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  title text NOT NULL,
  content text NOT NULL,
  author_id uuid NOT NULL,
  school_id uuid,
  type text DEFAULT 'general'::text CHECK (type = ANY (ARRAY[
    'general'::text, 'class_update'::text, 'system'::text
  ])),
  is_sent_to_all boolean DEFAULT false,
  target_user_id uuid,                 -- Para avisos privados (ex: lembretes de pagamento)
  CONSTRAINT announcements_pkey PRIMARY KEY (id),
  CONSTRAINT announcements_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT announcements_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE,
  CONSTRAINT announcements_target_user_id_fkey FOREIGN KEY (target_user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 2.6 Subscrições Push (Web Push Notifications)
CREATE TABLE public.push_subscriptions (
  id uuid NOT NULL DEFAULT uuid_generate_v4(),
  user_id uuid,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT push_subscriptions_pkey PRIMARY KEY (id),
  CONSTRAINT push_subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE
);
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 2.7 Pagamentos
CREATE TABLE public.payments (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  athlete_id uuid NOT NULL,
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL,
  status text NOT NULL DEFAULT 'Pendente'::text CHECK (status = ANY (ARRAY[
    'Pago'::text, 'Pendente'::text
  ])),
  amount numeric,
  school_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(athlete_id, month, year),
  CONSTRAINT payments_pkey PRIMARY KEY (id),
  CONSTRAINT payments_athlete_id_fkey FOREIGN KEY (athlete_id) REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT payments_school_id_fkey FOREIGN KEY (school_id) REFERENCES public.schools(id) ON DELETE CASCADE
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ==============================================================================
-- 3. ÍNDICES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_school_order_index ON public.schools(order_index, name);
CREATE INDEX IF NOT EXISTS idx_is_global_prof ON public.profiles(is_global_professor) WHERE is_global_professor = true;

-- ==============================================================================
-- 4. FUNÇÕES
-- ==============================================================================

-- Helper: Obter role do utilizador autenticado
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

-- Segundo professor numa aula (helper para RLS)
CREATE OR REPLACE FUNCTION public.is_second_professor_of_class(class_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes
    WHERE id = class_id_param AND second_professor_id = user_id_param
  );
$$;

-- Trigger: Criar perfil automaticamente no SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, school_id, date_of_birth, belt, email, needs_validation)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    COALESCE(new.raw_user_meta_data->>'role', 'Atleta'),
    (new.raw_user_meta_data->>'school_id')::UUID,
    (new.raw_user_meta_data->>'date_of_birth')::DATE,
    COALESCE(new.raw_user_meta_data->>'belt', 'Branco'),
    new.email,
    true
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Consultar Atletas Ausentes (Dashboard de Retenção)
CREATE OR REPLACE FUNCTION public.get_absent_athletes(
  p_days integer,
  p_requesting_user_id uuid,
  p_requesting_role text,
  p_requesting_school_id uuid DEFAULT NULL
)
RETURNS TABLE (
  athlete_id uuid, full_name text, belt text, school_name text,
  last_attendance date, days_absent integer, user_role text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  WITH last_classes AS (
    SELECT cb.user_id, MAX(c.date) as last_seen_date
    FROM public.class_bookings cb JOIN public.classes c ON cb.class_id = c.id
    WHERE cb.status = 'Presente' GROUP BY cb.user_id
  )
  SELECT
    p.id, p.full_name, p.belt, s.name,
    COALESCE(lc.last_seen_date, p.created_at::date),
    (CURRENT_DATE - COALESCE(lc.last_seen_date, p.created_at::date))::integer,
    p.role
  FROM public.profiles p
  LEFT JOIN last_classes lc ON p.id = lc.user_id
  LEFT JOIN public.schools s ON p.school_id = s.id
  WHERE COALESCE(p.is_archived, false) = false
    AND COALESCE(p.is_hidden, false) = false
    AND (CURRENT_DATE - COALESCE(lc.last_seen_date, p.created_at::date)) >= p_days
    AND (
      (p_requesting_role = 'Admin' AND (p_requesting_school_id IS NULL OR p.school_id = p_requesting_school_id))
      OR (p_requesting_role = 'Professor Responsável' AND p.school_id = p_requesting_school_id)
      OR (p_requesting_role = 'Professor' AND p.assigned_professor_id = p_requesting_user_id)
    )
  ORDER BY days_absent DESC;
END;
$$;

-- Pagamentos pendentes: criar avisos automáticos (disparado pelo Cron no dia 5)
CREATE OR REPLACE FUNCTION public.check_and_notify_pending_payments()
RETURNS void AS $$
DECLARE
  current_m integer := EXTRACT(MONTH FROM CURRENT_DATE);
  current_y integer := EXTRACT(YEAR FROM CURRENT_DATE);
  month_names text[] := ARRAY['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  v_user record; v_admin_id uuid;
BEGIN
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'Admin' AND is_archived = false LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN; END IF;
  FOR v_user IN
    SELECT id, full_name, school_id FROM public.profiles
    WHERE role = 'Atleta' AND is_archived = false
      AND NOT EXISTS (
        SELECT 1 FROM public.payments
        WHERE athlete_id = profiles.id AND month = current_m AND year = current_y AND status = 'Pago'
      )
  LOOP
    INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
    VALUES (
      'Lembrete de Pagamento (' || month_names[current_m] || ')',
      'Olá ' || split_part(v_user.full_name, ' ', 1) || ', a mensalidade de ' || month_names[current_m] || ' ainda não foi regularizada.',
      'system', v_admin_id, v_user.school_id, v_user.id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Push: notificar quando novo aviso é publicado
-- ✅ FIX 2026-04-07: avisos com target_user_id (ex: lembretes de pagamento)
--    enviam push APENAS ao utilizador visado, não aos gestores da escola.
CREATE OR REPLACE FUNCTION public.notify_push_on_announcement()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  supabase_url TEXT := 'https://cbbxlhdscqckqwuxbbuz.supabase.co';
  service_role_key TEXT;
  target_payload JSONB;
BEGIN
  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF service_role_key IS NULL THEN RETURN NEW; END IF;

  -- Prioridade: aviso privado → utilizador; aviso de escola → gestores; global → todos
  IF NEW.target_user_id IS NOT NULL THEN
    -- Aviso privado (ex: lembrete de pagamento) → push só para o destinatário
    target_payload := jsonb_build_object('user_id', NEW.target_user_id);
  ELSIF NEW.school_id IS NOT NULL THEN
    -- Aviso público de escola → push para gestores da escola (Admin + Prof. Responsável)
    target_payload := jsonb_build_object('school_id', NEW.school_id);
  ELSE
    -- Aviso global → push para todos os utilizadores
    target_payload := '\"all\"'::jsonb;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object(
        'target', target_payload,
        'title',  NEW.title,
        'body',   LEFT(NEW.content, 100),
        'url',    '/avisos'
      )::text::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Push falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Push: notificar admin quando atleta precisa de validação
CREATE OR REPLACE FUNCTION public.notify_push_on_validation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  supabase_url TEXT := 'https://cbbxlhdscqckqwuxbbuz.supabase.co';
  service_role_key TEXT;
  target_payload JSONB;
BEGIN
  IF NOT (NEW.needs_validation = TRUE AND (OLD IS NULL OR OLD.needs_validation IS DISTINCT FROM TRUE)) THEN
    RETURN NEW;
  END IF;

  BEGIN
    SELECT decrypted_secret INTO service_role_key
    FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
  IF service_role_key IS NULL THEN RETURN NEW; END IF;

  IF NEW.school_id IS NOT NULL THEN
    target_payload := jsonb_build_object('school_id', NEW.school_id);
  ELSE
    target_payload := '"admins"'::jsonb;
  END IF;

  BEGIN
    PERFORM net.http_post(
      url := supabase_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer ' || service_role_key),
      body := jsonb_build_object('target', target_payload, 'title', '✅ Nova Validação Pendente', 'body', NEW.full_name || ' aguarda validação.', 'url', '/admin/validacoes')::text::jsonb
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Push validação falhou: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- Apagar conta própria completamente (perfil + auth user)
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  -- Apagar perfil (cascata para bookings, pagamentos, push_subscriptions, etc.)
  DELETE FROM public.profiles WHERE id = v_uid;
  -- Apagar da autenticação — SECURITY DEFINER corre como postgres (acesso a auth.users)
  DELETE FROM auth.users WHERE id = v_uid;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public, auth;

-- ==============================================================================
-- 5. GATILHOS (TRIGGERS)
-- ==============================================================================

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

DROP TRIGGER IF EXISTS on_announcement_push ON public.announcements;
CREATE TRIGGER on_announcement_push
  AFTER INSERT ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_announcement();

DROP TRIGGER IF EXISTS on_validation_push ON public.profiles;
CREATE TRIGGER on_validation_push
  AFTER INSERT OR UPDATE OF needs_validation ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_push_on_validation();

-- ==============================================================================
-- 6. SEGURANÇA — RLS POLICIES
-- ==============================================================================

-- SCHOOLS
CREATE POLICY "Escolas visíveis por todos" ON public.schools
  FOR SELECT USING (true);
CREATE POLICY "Apenas Admin gere escolas" ON public.schools
  FOR ALL USING (public.get_auth_role() = 'Admin');

-- PROFILES
CREATE POLICY "Perfil próprio sempre visível" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Admin vê todos" ON public.profiles
  FOR ALL USING (public.get_auth_role() = 'Admin');
CREATE POLICY "Profs veem perfis da sua escola" ON public.profiles
  FOR SELECT USING (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );
CREATE POLICY "Atleta atualiza o próprio perfil" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- CLASSES
CREATE POLICY "Aulas visíveis por autenticados" ON public.classes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin gere todas as aulas" ON public.classes
  FOR ALL USING (public.get_auth_role() = 'Admin');
CREATE POLICY "Profs criam/editam aulas da sua escola" ON public.classes
  FOR ALL USING (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

-- CLASS BOOKINGS
CREATE POLICY "Gerir as próprias reservas" ON public.class_bookings
  FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Admin gere todas as reservas" ON public.class_bookings
  FOR ALL USING (public.get_auth_role() = 'Admin');
CREATE POLICY "Profs gerem reservas da sua escola" ON public.class_bookings
  FOR ALL USING (
    public.get_auth_role() IN ('Professor', 'Professor Responsável')
    AND EXISTS (
      SELECT 1 FROM public.classes c
      JOIN public.profiles p ON p.id = auth.uid()
      WHERE c.id = class_bookings.class_id AND (
        c.school_id = p.school_id OR c.professor_id = p.id OR
        public.is_second_professor_of_class(c.id, p.id)
      )
    )
  );

-- ANNOUNCEMENTS
CREATE POLICY "Visibilidade de avisos" ON public.announcements
  FOR SELECT USING (
    (target_user_id IS NULL AND (
      school_id IS NULL OR
      EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.school_id = announcements.school_id)
    ))
    OR target_user_id = auth.uid()
    OR public.get_auth_role() IN ('Admin', 'Professor', 'Professor Responsável')
  );
CREATE POLICY "Admins e Professores criam avisos" ON public.announcements
  FOR INSERT TO authenticated WITH CHECK (
    public.get_auth_role() IN ('Admin', 'Professor', 'Professor Responsável')
  );
CREATE POLICY "Autores ou Admins eliminam avisos" ON public.announcements
  FOR DELETE USING (
    author_id = auth.uid() OR public.get_auth_role() = 'Admin'
  );

-- PUSH SUBSCRIPTIONS
CREATE POLICY "Utilizadores gerem as próprias subscrições" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- PAYMENTS
CREATE POLICY "Atleta vê os próprios pagamentos" ON public.payments
  FOR SELECT USING (auth.uid() = athlete_id);
CREATE POLICY "Admin gere todos os pagamentos" ON public.payments
  FOR ALL USING (public.get_auth_role() = 'Admin');
CREATE POLICY "Prof Responsável gere pagamentos da sua escola" ON public.payments
  FOR ALL USING (
    public.get_auth_role() = 'Professor Responsável'
    AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
  );

-- ==============================================================================
-- 7. AGENDAMENTOS (CRON)
-- ==============================================================================

-- Lembrete de pagamento às 8h do dia 5 de cada mês
SELECT cron.schedule(
  'monthly_payment_reminder',
  '0 8 5 * *',
  $$SELECT public.check_and_notify_pending_payments()$$
);

-- ==============================================================================
-- 8. VAULT: Guardar a Service Role Key (corre UMA vez após criar o projeto)
-- ==============================================================================
-- SELECT vault.create_secret('supabase_service_role_key', '<COLE_AQUI_A_SERVICE_ROLE_KEY>');

-- ==============================================================================
-- FIM DO SCRIPT
-- ZR Team App — Estrutura completa e funcional mas não definitiva ✅
-- ==============================================================================
