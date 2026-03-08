-- =======================================================================================
-- FUNÇÃO RPC: GET ABSENT ATHLETES (Atletas Inativos / Retenção)
-- =======================================================================================
-- Esta função permite consultar, de forma eficiente e diretamente na Base de Dados,
-- que atletas não efetuam treinos (check-in de "Presente") há mais de X dias especificados.
-- Se um atleta nunca treinou desde que criou a conta, o contador de ausência é 
-- baseado na sua data de registo (created_at).
-- =======================================================================================

CREATE OR REPLACE FUNCTION public.get_absent_athletes(p_days integer, p_school_id uuid DEFAULT NULL)
RETURNS TABLE (
    athlete_id uuid,
    full_name text,
    belt text,
    school_name text,
    last_attendance date,
    days_absent integer
) 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    WITH last_classes AS (
        SELECT 
            cb.user_id,
            MAX(c.date) as last_seen_date
        FROM public.class_bookings cb
        JOIN public.classes c ON cb.class_id = c.id
        WHERE cb.status = 'Presente'
        GROUP BY cb.user_id
    )
    SELECT 
        p.id AS athlete_id,
        p.full_name,
        p.belt,
        s.name AS school_name,
        COALESCE(lc.last_seen_date, p.created_at::date) AS last_attendance,
        (CURRENT_DATE - COALESCE(lc.last_seen_date, p.created_at::date))::integer AS days_absent
    FROM public.profiles p
    LEFT JOIN last_classes lc ON p.id = lc.user_id
    LEFT JOIN public.schools s ON p.school_id = s.id
    WHERE p.role = 'Atleta'
      AND COALESCE(p.is_archived, false) = false
      AND (p_school_id IS NULL OR p.school_id = p_school_id)
      AND (CURRENT_DATE - COALESCE(lc.last_seen_date, p.created_at::date)) >= p_days
    ORDER BY days_absent DESC;
END;
$$;
