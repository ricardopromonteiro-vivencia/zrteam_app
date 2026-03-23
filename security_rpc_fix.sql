-- ==============================================================================
-- 🥋 SEGURANÇA DE RPC: PROTEÇÃO CONTRA ESCALADA DE PRIVILÉGIOS
-- ==============================================================================

-- 1. INCREMENTAR AULAS (Seguro)
CREATE OR REPLACE FUNCTION public.increment_attended_classes(user_id_param UUID)
RETURNS void AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_school_id UUID;
    v_target_school_id UUID;
BEGIN
    IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    -- Obter dados do chamador
    SELECT role, school_id INTO v_caller_role, v_caller_school_id 
    FROM public.profiles WHERE id = v_caller_id;

    -- Obter escola do alvo
    SELECT school_id INTO v_target_school_id 
    FROM public.profiles WHERE id = user_id_param;

    -- REGRA: Admin faz tudo. 
    -- Professor/Prof Responsável apenas na própria escola.
    -- Atleta NUNCA incrementa (nem a si mesmo).
    IF v_caller_role = 'Admin' OR 
       (v_caller_role IN ('Professor', 'Professor Responsável') AND v_caller_school_id = v_target_school_id) THEN
        UPDATE public.profiles 
        SET attended_classes = attended_classes + 1 
        WHERE id = user_id_param;
    ELSE
        RAISE EXCEPTION 'Não tens permissão para marcar presenças para este atleta.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. DECREMENTAR AULAS (Seguro)
CREATE OR REPLACE FUNCTION public.decrement_attended_classes(user_id_param UUID)
RETURNS void AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
    v_caller_school_id UUID;
    v_target_school_id UUID;
BEGIN
    IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;

    SELECT role, school_id INTO v_caller_role, v_caller_school_id 
    FROM public.profiles WHERE id = v_caller_id;

    SELECT school_id INTO v_target_school_id 
    FROM public.profiles WHERE id = user_id_param;

    IF v_caller_role = 'Admin' OR 
       (v_caller_role IN ('Professor', 'Professor Responsável') AND v_caller_school_id = v_target_school_id) THEN
        UPDATE public.profiles 
        SET attended_classes = GREATEST(0, attended_classes - 1)
        WHERE id = user_id_param;
    ELSE
        RAISE EXCEPTION 'Não tens permissão para remover presenças para este atleta.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. LISTA DE PRESENÇAS RECENTES (Seguro)
-- Ignora role/escola passados pelo frontend e usa a identidade real do auth.uid()
CREATE OR REPLACE FUNCTION public.get_recent_attendances(
    p_days_ago integer DEFAULT 7,
    p_requesting_user_id uuid DEFAULT NULL,   -- Mantido para compatibilidade, mas ignorado
    p_requesting_role text DEFAULT NULL,      -- Mantido para compatibilidade, mas ignorado
    p_requesting_school_id uuid DEFAULT NULL  -- Apenas Admin pode usar isto
)
RETURNS TABLE (
    booking_id uuid, user_id uuid, full_name text, belt text,
    class_id uuid, class_title text, class_date date,
    class_start_time time without time zone,
    school_id uuid, school_name text, status text,
    created_at timestamp with time zone
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_real_uid UUID := auth.uid();
    v_real_role TEXT;
    v_real_school_id UUID;
BEGIN
    -- Determinar identidade real
    SELECT role, school_id INTO v_real_role, v_real_school_id 
    FROM public.profiles WHERE id = v_real_uid;

    RETURN QUERY
    SELECT 
        cb.id, p.id, p.full_name, p.belt, c.id, c.title, c.date, c.start_time,
        s.id, s.name, cb.status, cb.created_at
    FROM public.class_bookings cb
    JOIN public.classes c ON cb.class_id = c.id
    JOIN public.profiles p ON cb.user_id = p.id
    LEFT JOIN public.schools s ON c.school_id = s.id
    WHERE c.date >= (CURRENT_DATE - p_days_ago)
    AND (
        -- Admin vê tudo OU filtra se pediu explicitamente
        (v_real_role = 'Admin' AND (p_requesting_school_id IS NULL OR c.school_id = p_requesting_school_id))
        -- Professores vêem APENAS a sua escola, ignorando o que o frontend possa injetar
        OR (v_real_role IN ('Professor Responsável', 'Professor') AND c.school_id = v_real_school_id)
    )
    ORDER BY c.date DESC, c.start_time DESC, p.full_name ASC;
END;
$$;

-- 4. ATLETAS AUSENTES (Seguro)
CREATE OR REPLACE FUNCTION public.get_absent_athletes(
  p_days integer,
  p_requesting_user_id uuid DEFAULT NULL,    -- Ignorado
  p_requesting_role text DEFAULT NULL,       -- Ignorado
  p_requesting_school_id uuid DEFAULT NULL   -- Apenas Admin pode usar isto
)
RETURNS TABLE (
  athlete_id uuid, full_name text, belt text, school_name text,
  last_attendance date, days_absent integer, user_role text
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_real_uid UUID := auth.uid();
    v_real_role TEXT;
    v_real_school_id UUID;
BEGIN
    SELECT role, school_id INTO v_real_role, v_real_school_id 
    FROM public.profiles WHERE id = v_real_uid;

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
        (v_real_role = 'Admin' AND (p_requesting_school_id IS NULL OR p.school_id = p_requesting_school_id))
        OR (v_real_role = 'Professor Responsável' AND p.school_id = v_real_school_id)
        OR (v_real_role = 'Professor' AND p.assigned_professor_id = v_real_uid)
      )
    ORDER BY days_absent DESC;
END;
$$;
