-- ==========================================
-- CONFIGURAÇÃO DA ACADEMIA E SEGURANÇA
-- ==========================================

-- 1. Tabela de Configurações da Academia
CREATE TABLE IF NOT EXISTS public.academy_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    academy_name TEXT NOT NULL DEFAULT 'ZR Team',
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 50,
    allowed_wifi_ip TEXT, -- IP Público da Academia
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT one_row CHECK (id = 1) -- Garante que só existe uma configuração
);

VALUES (1, 38.7223, -9.1393, 50, '127.0.0.1')
ON CONFLICT (id) DO NOTHING;

-- 2. Segurança: RLS para academy_config
ALTER TABLE public.academy_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos os autenticados podem ver a config" ON public.academy_config
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Apenas Admin pode atualizar a config" ON public.academy_config
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'Admin'
      )
    );

-- 3. Função para Validar Proximidade (Geofencing)
-- Usa a fórmula de Haversine para calcular distância entre dois pontos
CREATE OR REPLACE FUNCTION public.calculate_distance(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT)
RETURNS FLOAT AS $$
DECLARE
    dist FLOAT;
    rad_lat1 FLOAT;
    rad_lat2 FLOAT;
    delta_lat FLOAT;
    delta_lon FLOAT;
    a FLOAT;
    c FLOAT;
BEGIN
    rad_lat1 := pi() * lat1 / 180;
    rad_lat2 := pi() * lat2 / 180;
    delta_lat := pi() * (lat2 - lat1) / 180;
    delta_lon := pi() * (lon2 - lon1) / 180;

    a := sin(delta_lat/2) * sin(delta_lat/2) +
         cos(rad_lat1) * cos(rad_lat2) *
         sin(delta_lon/2) * sin(delta_lon/2);
    c := 2 * atan2(sqrt(a), sqrt(1-a));
    dist := 6371000 * c; -- Distância em metros (raio da Terra = 6371km)
    
    RETURN dist;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. Função Principal de Check-In Seguro
-- Esta função valida GPS, IP e Horário antes de marcar a presença.
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
    v_user_id := auth.uid(); -- Obter o ID do utilizador autenticado diretamente da sessão

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão expirada. Por favor, faz login novamente.');
    END IF;

    -- 1. Obter configuração da academia
    SELECT * INTO v_config FROM public.academy_config WHERE id = 1;

    -- 2. Validar IP (Apenas se allowed_wifi_ip estiver preenchido e não for 'OFF')
    IF v_config.allowed_wifi_ip IS NOT NULL AND v_config.allowed_wifi_ip != '' AND v_config.allowed_wifi_ip != 'OFF' THEN
        IF p_client_ip != v_config.allowed_wifi_ip THEN
            RETURN jsonb_build_object('success', false, 'error', 'Rede WiFi incorreta. Liga-te ao WiFi da Academia.');
        END IF;
    END IF;

    -- 3. Validar Proximidade (GPS)
    v_distance := calculate_distance(p_lat, p_lng, v_config.latitude, v_config.longitude);
    IF v_distance > v_config.radius_meters THEN
        RETURN jsonb_build_object('success', false, 'error', 'Estás demasiado longe da Academia para fazer check-in.');
    END IF;

    -- 4. Encontrar aula ativa (30 min antes ou durante a aula)
    SELECT cb.*, c.title, c.start_time 
    INTO v_booking
    FROM public.class_bookings cb
    JOIN public.classes c ON cb.class_id = c.id
    WHERE cb.user_id = v_user_id
      AND cb.status = 'Marcado'
      AND c.date = CURRENT_DATE
      AND (v_now >= (c.date + c.start_time - interval '30 minutes'))
      AND (v_now <= (c.date + c.end_time + interval '15 minutes'))
    LIMIT 1;

    IF v_booking IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Não tens nenhuma aula agendada para este horário ou a janela de check-in expirou.');
    END IF;

    -- 5. Se tudo estiver OK, marcar presença
    UPDATE public.class_bookings 
    SET status = 'Presente', updated_at = v_now 
    WHERE id = v_booking.id;

    -- Incrementar contador no perfil
    UPDATE public.profiles 
    SET attended_classes = attended_classes + 1 
    WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Check-in realizado com sucesso!',
        'class_title', v_booking.title
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
