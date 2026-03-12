-- ==============================================================================
-- 🥋 JIUT-JITSU APP - ESTRUTURA COMPLETA DA PLATAFORMA (LIMPA)
-- ==============================================================================
-- Este script contém a definição de todas as tabelas, funções, triggers e RLS.
-- Ideal para criar um novo projeto "espelho" ou servir de cópia de segurança técnica.
-- Data: 2026-03-10
-- ==============================================================================

-- 1. EXTENSÕES NECESSÁRIAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_net SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- 2. TABELAS ESTRUTURAIS

-- Escolas
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    radius_meters INTEGER DEFAULT 50,
    head_professor_id UUID, -- Referência circular tratada depois
    order_index INTEGER DEFAULT 99,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Perfis de Utilizador
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Professor', 'Professor Responsável', 'Atleta')) DEFAULT 'Atleta',
    belt TEXT NOT NULL DEFAULT 'Branco',
    degrees INTEGER NOT NULL DEFAULT 0,
    attended_classes INTEGER NOT NULL DEFAULT 0,
    school_id UUID REFERENCES public.schools(id),
    date_of_birth DATE,
    is_global_professor BOOLEAN DEFAULT false,
    assigned_professor_id UUID REFERENCES public.profiles(id),
    is_archived BOOLEAN DEFAULT false,
    needs_validation BOOLEAN DEFAULT true, -- Atletas novos precisam de validação
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Referência da tabela Schools para Profiles (Head Professor)
ALTER TABLE public.schools ADD CONSTRAINT schools_head_professor_id_fkey 
    FOREIGN KEY (head_professor_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Aulas (Classes)
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 30,
    professor_id UUID REFERENCES public.profiles(id) NOT NULL,
    second_professor_id UUID REFERENCES public.profiles(id) DEFAULT null,
    school_id UUID REFERENCES public.schools(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Reservas e Presenças (Class Bookings)
CREATE TABLE IF NOT EXISTS public.class_bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    class_id UUID REFERENCES public.classes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Marcado', 'Presente', 'Falta')) DEFAULT 'Marcado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(class_id, user_id)
);

-- Avisos / Notícias
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    target_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- Para avisos privados (ex: pagamentos)
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'class_update', 'system')),
    is_sent_to_all BOOLEAN DEFAULT FALSE
);

-- Subscrições Push (Web Push)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Pagamentos
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    athlete_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    year INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Pago', 'Pendente')) DEFAULT 'Pendente',
    amount DECIMAL(10,2),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(athlete_id, month, year)
);

-- 3. FUNÇÕES DE SUPORTE E LÓGICA DE NEGÓCIO

-- Função para obter o role do utilizador atual (Helper)
CREATE OR REPLACE FUNCTION public.get_auth_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Cálculo de distância (GPS) em metros
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 float, lon1 float, lat2 float, lon2 float)
RETURNS float AS $$
DECLARE                                                     
    dist float = 0;          
    rad_lat1 float; rad_lat2 float; rad_delta_lat float; rad_delta_lon float;
    a float; c float;
    R float = 6371000; -- Raio da Terra em metros
BEGIN                    
    rad_lat1 = pi() * lat1 / 180;
    rad_lat2 = pi() * lat2 / 180;
    rad_delta_lat = pi() * (lat2 - lat1) / 180;
    rad_delta_lon = pi() * (lon2 - lon1) / 180;
    a = sin(rad_delta_lat/2) * sin(rad_delta_lat/2) + cos(rad_lat1) * cos(rad_lat2) * sin(rad_delta_lon/2) * sin(rad_delta_lon/2);
    c = 2 * atan2(sqrt(a), sqrt(1-a));
    dist = R * c;
    RETURN dist;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para criar perfil automaticamente no SignUp
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, school_id, date_of_birth, belt, needs_validation)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'Atleta'),
    (new.raw_user_meta_data->>'school_id')::UUID,
    (new.raw_user_meta_data->>'date_of_birth')::DATE,
    COALESCE(new.raw_user_meta_data->>'belt', 'Branco'),
    true -- Novos registos entram para validação
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Check-in Seguro (Lógica de GPS e Horário)
CREATE OR REPLACE FUNCTION public.secure_checkin(p_lat FLOAT, p_lng FLOAT, p_client_ip TEXT)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_profile RECORD;
    v_school RECORD;
    v_distance FLOAT;
    v_booking RECORD;
    v_now TIMESTAMP WITH TIME ZONE := now();
BEGIN
    IF v_user_id IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sessão expirada.'); END IF;
    SELECT * INTO v_profile FROM public.profiles WHERE id = v_user_id;
    SELECT * INTO v_school FROM public.schools WHERE id = v_profile.school_id;
    IF v_school IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Escola não associada.'); END IF;

    -- Validar Proximidade
    v_distance := public.calculate_distance(p_lat, p_lng, v_school.latitude, v_school.longitude);
    IF v_distance > v_school.radius_meters THEN
        RETURN jsonb_build_object('success', false, 'error', 'Demasiado longe da escola ' || v_school.name);
    END IF;

    -- Procurar reserva na janela de 30m
    SELECT cb.id, c.title FROM public.class_bookings cb
    JOIN public.classes c ON cb.class_id = c.id
    WHERE cb.user_id = v_user_id AND cb.status = 'Marcado' AND c.date = CURRENT_DATE
      AND (v_now >= (c.date + c.start_time - interval '30 minutes'))
      AND (v_now <= (c.date + c.end_time + interval '30 minutes'))
    LIMIT 1 INTO v_booking;

    IF v_booking IS NULL THEN RETURN jsonb_build_object('success', false, 'error', 'Sem reserva ativa para este horário.'); END IF;

    UPDATE public.class_bookings SET status = 'Presente', updated_at = v_now WHERE id = v_booking.id;
    UPDATE public.profiles SET attended_classes = attended_classes + 1 WHERE id = v_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Check-in ' || v_booking.title || ' OK!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Consultar Atletas Ausentes (Dashboard Retenção)
CREATE OR REPLACE FUNCTION public.get_absent_athletes(p_days integer, p_requesting_user_id uuid, p_requesting_role text, p_requesting_school_id uuid DEFAULT NULL)
RETURNS TABLE (athlete_id uuid, full_name text, belt text, school_name text, last_attendance date, days_absent integer, user_role text) 
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    RETURN QUERY
    WITH last_classes AS (
        SELECT cb.user_id, MAX(c.date) as last_seen_date
        FROM public.class_bookings cb JOIN public.classes c ON cb.class_id = c.id
        WHERE cb.status = 'Presente' GROUP BY cb.user_id
    )
    SELECT p.id, p.full_name, p.belt, s.name, COALESCE(lc.last_seen_date, p.created_at::date), (CURRENT_DATE - COALESCE(lc.last_seen_date, p.created_at::date))::integer, p.role
    FROM public.profiles p
    LEFT JOIN last_classes lc ON p.id = lc.user_id
    LEFT JOIN public.schools s ON p.school_id = s.id
    WHERE COALESCE(p.is_archived, false) = false
      AND (CURRENT_DATE - COALESCE(lc.last_seen_date, p.created_at::date)) >= p_days
      AND ((p_requesting_role = 'Admin') OR (p_requesting_role = 'Professor Responsável' AND p.school_id = p_requesting_school_id) OR (p_requesting_role = 'Professor' AND p.assigned_professor_id = p_requesting_user_id))
    ORDER BY days_absent DESC;
END;
$$;

-- Notificações de Pagamentos Pendentes (Triggered by Cron)
CREATE OR REPLACE FUNCTION public.check_and_notify_pending_payments()
RETURNS void AS $$
DECLARE
    current_m integer := EXTRACT(MONTH FROM CURRENT_DATE);
    current_y integer := EXTRACT(YEAR FROM CURRENT_DATE);
    month_names text[] := ARRAY['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    v_user record; v_admin_id uuid;
BEGIN
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'Admin' AND is_archived = false LIMIT 1;
    IF v_admin_id IS NULL THEN RETURN; END IF;
    FOR v_user IN SELECT id, full_name, school_id FROM public.profiles WHERE role = 'Atleta' AND is_archived = false
      AND NOT EXISTS (SELECT 1 FROM public.payments WHERE athlete_id = profiles.id AND month = current_m AND year = current_y AND status = 'Pago')
    LOOP
        INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
        VALUES ('Lembrete de Pagamento', 'Olá ' || split_part(v_user.full_name, ' ', 1) || ', a mensalidade de ' || month_names[current_m] || ' está pendente.', 'system', v_admin_id, v_user.school_id, v_user.id);
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Notificações Push (DATABASE -> EDGE FUNCTION)
CREATE OR REPLACE FUNCTION public.notify_push_on_announcement() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    service_role_key TEXT;
BEGIN
    SELECT decrypted_secret INTO service_role_key FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;
    IF service_role_key IS NULL THEN RETURN NEW; END IF;
    PERFORM net.http_post(
        url := (SELECT value FROM settings WHERE key='supabase_url') || '/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || service_role_key),
        body := jsonb_build_object('target', CASE WHEN NEW.school_id IS NOT NULL THEN jsonb_build_object('school_id', NEW.school_id) ELSE '"all"'::jsonb END, 'title', NEW.title, 'body', LEFT(NEW.content, 100), 'url', '/avisos')::text::jsonb
    );
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN RETURN NEW; END;
$$;

-- 4. GATILHOS (TRIGGERS)
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
CREATE TRIGGER on_announcement_push AFTER INSERT ON public.announcements FOR EACH ROW EXECUTE PROCEDURE public.notify_push_on_announcement();

-- 5. SEGURANÇA (RLS POLICIES)

-- Admin controls everything
CREATE POLICY "Admin full access" ON public.schools FOR ALL USING (public.get_auth_role() = 'Admin');
CREATE POLICY "Admin full access" ON public.profiles FOR ALL USING (public.get_auth_role() = 'Admin');
CREATE POLICY "Admin full access" ON public.classes FOR ALL USING (public.get_auth_role() = 'Admin');
CREATE POLICY "Admin full access" ON public.payments FOR ALL USING (public.get_auth_role() = 'Admin');

-- Schools
CREATE POLICY "Select schools" ON public.schools FOR SELECT USING (true);

-- Profiles
CREATE POLICY "Select active profiles" ON public.profiles FOR SELECT USING (is_archived = false);
CREATE POLICY "Atletas update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Classes
CREATE POLICY "Select classes" ON public.classes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profs manage classes of school" ON public.classes FOR ALL USING (school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()));

-- Bookings
ALTER TABLE public.class_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Manage own bookings" ON public.class_bookings FOR ALL USING (user_id = auth.uid());
CREATE POLICY "Profs manage bookings of school" ON public.class_bookings FOR ALL USING (EXISTS (SELECT 1 FROM public.classes c JOIN public.profiles p ON p.school_id = c.school_id WHERE c.id = class_bookings.class_id AND p.id = auth.uid() AND p.role IN ('Professor', 'Professor Responsável')));

-- 6. AGENDAMENTOS (CRON)
SELECT cron.schedule('monthly_payment_reminder', '0 8 5 * *', $$SELECT public.check_and_notify_pending_payments()$$);

-- ==============================================================================
-- FIM DO SCRIPT
-- ==============================================================================
