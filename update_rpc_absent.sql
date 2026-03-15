-- EXECUTAR NO SQL EDITOR DO SUPABASE
-- Este script atualiza a função de retenção para suportar o filtro de escola selecionado pelo Admin.

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
