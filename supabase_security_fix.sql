-- 🛡️ Reforço de Segurança SQL "All-in-One"
-- Autor: Monteirismo

-- Este script recria as funções com as definições de segurança recomendadas (search_path fixo).
-- Resolve os avisos "Function Search Path Mutable" e garante que as assinaturas estão corretas.

-- 1. Função de Boas-vindas (Trigger de Registo)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  generated_uid TEXT;
BEGIN
  generated_uid := substr(md5(random()::text), 1, 8);
  INSERT INTO public.profiles (id, full_name, role, nfc_uid)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'Atleta'),
    COALESCE(new.raw_user_meta_data->>'nfc_uid', generated_uid)
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Funções de Contador de Aulas
CREATE OR REPLACE FUNCTION public.increment_attended_classes(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET attended_classes = attended_classes + 1
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.decrement_attended_classes(user_id_param UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.profiles
  SET attended_classes = GREATEST(attended_classes - 1, 0)
  WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Função de Cálculo de Distância
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
DECLARE
    dist FLOAT;
    rad_lat1 FLOAT; rad_lat2 FLOAT; delta_lat FLOAT; delta_lon FLOAT; a FLOAT; c FLOAT;
BEGIN
    rad_lat1 := pi() * lat1 / 180;
    rad_lat2 := pi() * lat2 / 180;
    delta_lat := pi() * (lat2 - lat1) / 180;
    delta_lon := pi() * (lon2 - lon1) / 180;
    a := sin(delta_lat/2) * sin(delta_lat/2) + cos(rad_lat1) * cos(rad_lat2) * sin(delta_lon/2) * sin(delta_lon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    dist := 6371000 * c;
    RETURN dist;
END;
$$ LANGUAGE plpgsql IMMUTABLE SET search_path = public;

-- 4. Função Principal de Check-In Seguro (GPS + IP)
-- Primeiro, tentamos remover a versão antiga com 4 parâmetros se ainda existir por engano
DROP FUNCTION IF EXISTS public.secure_checkin(UUID, FLOAT, FLOAT, TEXT);

CREATE OR REPLACE FUNCTION public.secure_checkin(
    p_lat FLOAT,
    p_lng FLOAT,
    p_client_ip TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_config RECORD;
    v_distance FLOAT;
    v_booking RECORD;
    v_now TIMESTAMP WITH TIME ZONE;
BEGIN
    v_now := now();
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão expirada.');
    END IF;
    SELECT * INTO v_config FROM public.academy_config WHERE id = 1;
    IF v_config.allowed_wifi_ip IS NOT NULL AND v_config.allowed_wifi_ip != '' AND v_config.allowed_wifi_ip != 'OFF' THEN
        IF p_client_ip != v_config.allowed_wifi_ip THEN
            RETURN jsonb_build_object('success', false, 'error', 'Rede WiFi incorreta.');
        END IF;
    END IF;
    v_distance := public.calculate_distance(p_lat, p_lng, v_config.latitude, v_config.longitude);
    IF v_distance > v_config.radius_meters THEN
        RETURN jsonb_build_object('success', false, 'error', 'Demasiado longe da Academia.');
    END IF;
    SELECT cb.id, c.title 
    INTO v_booking
    FROM public.class_bookings cb
    JOIN public.classes c ON cb.class_id = c.id
    WHERE cb.user_id = v_user_id AND cb.status = 'Marcado' AND c.date = CURRENT_DATE
      AND (v_now >= (c.date + c.start_time - interval '30 minutes'))
      AND (v_now <= (c.date + c.end_time + interval '15 minutes'))
    LIMIT 1;
    IF v_booking IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sem reserva ativa para este horário.');
    END IF;
    UPDATE public.class_bookings SET status = 'Presente', updated_at = v_now WHERE id = v_booking.id;
    UPDATE public.profiles SET attended_classes = attended_classes + 1 WHERE id = v_user_id;
    RETURN jsonb_build_object('success', true, 'message', 'Check-in realizado!', 'class_title', v_booking.title);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
