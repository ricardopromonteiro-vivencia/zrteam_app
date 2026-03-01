-- 🔄 Atualização do Check-In Seguro (Fase 6)
-- Suporta auto-reserva e seleção de aula específica

CREATE OR REPLACE FUNCTION public.secure_checkin(
    p_lat FLOAT,
    p_lng FLOAT,
    p_client_ip TEXT,
    p_class_id UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_config RECORD;
    v_distance FLOAT;
    v_booking_id UUID;
    v_class_id UUID;
    v_class_title TEXT;
    v_now TIMESTAMP WITH TIME ZONE;
BEGIN
    v_now := now();
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão expirada.');
    END IF;

    -- 1. Validar Configuração da Academia
    SELECT * INTO v_config FROM public.academy_config WHERE id = 1;
    
    -- Validar IP se configurado
    IF v_config.allowed_wifi_ip IS NOT NULL AND v_config.allowed_wifi_ip != '' AND v_config.allowed_wifi_ip != 'OFF' THEN
        IF p_client_ip != v_config.allowed_wifi_ip THEN
            RETURN jsonb_build_object('success', false, 'error', 'Rede WiFi incorreta.');
        END IF;
    END IF;

    -- Validar Distância GPS
    v_distance := public.calculate_distance(p_lat, p_lng, v_config.latitude, v_config.longitude);
    IF v_distance > v_config.radius_meters THEN
        RETURN jsonb_build_object('success', false, 'error', 'Demasiado longe da Academia.');
    END IF;

    -- 2. Identificar a Aula
    -- Se p_class_id for passado, usamos esse. Caso contrário, procuramos uma aula ativa.
    IF p_class_id IS NOT NULL THEN
        SELECT id, title INTO v_class_id, v_class_title 
        FROM public.classes 
        WHERE id = p_class_id 
          AND date = CURRENT_DATE
          AND (v_now >= (date + start_time - interval '30 minutes'))
          AND (v_now <= (date + end_time + interval '15 minutes'));
          
        IF v_class_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'A aula selecionada não está ativa agora.');
        END IF;
    ELSE
        -- Procurar aula ativa (se houver mais que uma sem p_class_id, retornamos erro pedindo seleção)
        SELECT id, title INTO v_class_id, v_class_title
        FROM public.classes
        WHERE date = CURRENT_DATE
          AND (v_now >= (date + start_time - interval '30 minutes'))
          AND (v_now <= (date + end_time + interval '15 minutes'))
        LIMIT 2; -- Pegamos 2 para saber se há ambiguidade

        IF v_class_id IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Não há aulas ativas neste momento.');
        END IF;
        
        -- Se houver ambiguidade (mais que uma aula ativa e não especificou ID)
        -- Nota: v_class_id terá o primeiro resultado, mas vamos validar se há mais
        IF (SELECT count(*) FROM public.classes WHERE date = CURRENT_DATE AND (v_now >= (date + start_time - interval '30 minutes')) AND (v_now <= (date + end_time + interval '15 minutes'))) > 1 THEN
            RETURN jsonb_build_object('success', false, 'error', 'MULTIPLE_CLASSES', 'message', 'Existem várias aulas a decorrer. Por favor seleciona uma.');
        END IF;
    END IF;

    -- 3. Verificar Reserva ou Criar Auto-Reserva
    SELECT id INTO v_booking_id 
    FROM public.class_bookings 
    WHERE user_id = v_user_id AND class_id = v_class_id;

    IF v_booking_id IS NOT NULL THEN
        -- Já existe reserva, atualizar para Presente
        UPDATE public.class_bookings SET status = 'Presente', updated_at = v_now WHERE id = v_booking_id;
    ELSE
        -- Criar Auto-Reserva já como Presente
        INSERT INTO public.class_bookings (class_id, user_id, status, created_at)
        VALUES (v_class_id, v_user_id, 'Presente', v_now)
        RETURNING id INTO v_booking_id;
    END IF;

    -- 4. Incrementar contador de aulas
    UPDATE public.profiles SET attended_classes = attended_classes + 1 WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Check-in realizado!', 
        'class_title', v_class_title,
        'auto_booked', (v_booking_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.class_bookings WHERE id = v_booking_id AND updated_at IS NOT NULL))
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
