-- ==========================================================
-- RPC: get_weekly_ranking
-- Retorna o ranking semanal de presenças por escola
-- Contorna RLS para permitir que qualquer utilizador veja o ranking
-- ==========================================================
CREATE OR REPLACE FUNCTION get_weekly_ranking(
  p_school_id UUID DEFAULT NULL,
  p_week_start DATE DEFAULT NULL,
  p_week_end DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  role TEXT,
  belt TEXT,
  count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cb.user_id,
    p.full_name,
    p.role,
    p.belt,
    COUNT(*)::BIGINT AS count
  FROM class_bookings cb
  JOIN profiles p ON p.id = cb.user_id
  JOIN classes c ON c.id = cb.class_id
  WHERE cb.status = 'Presente'
    AND c.date >= COALESCE(p_week_start, date_trunc('week', CURRENT_DATE)::DATE)
    AND c.date <= COALESCE(p_week_end, (date_trunc('week', CURRENT_DATE) + INTERVAL '6 days')::DATE)
    AND p.is_hidden = false
    AND (p_school_id IS NULL OR p.school_id = p_school_id)
  GROUP BY cb.user_id, p.full_name, p.role, p.belt
  ORDER BY count DESC
  LIMIT 10;
$$;

-- ==========================================================
-- RPC: get_monthly_ranking
-- Retorna o ranking mensal de presenças por escola (mês actual)
-- ==========================================================
CREATE OR REPLACE FUNCTION get_monthly_ranking(
  p_school_id UUID DEFAULT NULL,
  p_month_start DATE DEFAULT NULL,
  p_month_end DATE DEFAULT NULL
)
RETURNS TABLE (
  user_id UUID,
  full_name TEXT,
  role TEXT,
  belt TEXT,
  count BIGINT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    cb.user_id,
    p.full_name,
    p.role,
    p.belt,
    COUNT(*)::BIGINT AS count
  FROM class_bookings cb
  JOIN profiles p ON p.id = cb.user_id
  JOIN classes c ON c.id = cb.class_id
  WHERE cb.status = 'Presente'
    AND c.date >= COALESCE(p_month_start, date_trunc('month', CURRENT_DATE)::DATE)
    AND c.date <= COALESCE(p_month_end, (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE)
    AND p.is_hidden = false
    AND (p_school_id IS NULL OR p.school_id = p_school_id)
  GROUP BY cb.user_id, p.full_name, p.role, p.belt
  ORDER BY count DESC
  LIMIT 10;
$$;
