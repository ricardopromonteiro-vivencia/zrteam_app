-- ==============================================================================
-- FIX: Erro 42702 - "school_id is ambiguous" na função get_recent_attendances
-- O RETURNS TABLE tem uma coluna "school_id" e o WHERE interno também usa "school_id"
-- causando ambiguidade. Solução: usar aliases explícitos e qualificar tudo.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_recent_attendances(
    p_days_ago integer DEFAULT 7,
    p_requesting_user_id uuid DEFAULT NULL,
    p_requesting_role text DEFAULT NULL,
    p_requesting_school_id uuid DEFAULT NULL
)
RETURNS TABLE (
    booking_id uuid,
    user_id uuid,
    full_name text,
    belt text,
    class_id uuid,
    class_title text,
    class_date date,
    class_start_time time without time zone,
    school_id uuid,
    school_name text,
    status text,
    created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cb.id            AS booking_id,
        p.id             AS user_id,
        p.full_name      AS full_name,
        p.belt           AS belt,
        c.id             AS class_id,
        c.title          AS class_title,
        c.date           AS class_date,
        c.start_time     AS class_start_time,
        s.id             AS school_id,       -- alias explícito para a coluna do RETURNS TABLE
        s.name           AS school_name,
        cb.status        AS status,
        cb.created_at    AS created_at
    FROM 
        public.class_bookings cb
    JOIN 
        public.classes c ON cb.class_id = c.id
    JOIN 
        public.profiles p ON cb.user_id = p.id
    LEFT JOIN 
        public.schools s ON c.school_id = s.id   -- sem ambiguidade: qualificado com c.school_id
    WHERE 
        c.date >= (CURRENT_DATE - p_days_ago)
        -- Admin: vê todas as escolas. 
        -- P.Resp/Professor local: vêem apenas as aulas que ocorreram na sua escola.
        AND (
            p_requesting_role = 'Admin' 
            OR (
                p_requesting_role IN ('Professor Responsável', 'Professor')
                AND c.school_id = p_requesting_school_id   -- qualificado com c.school_id
            )
        )
    ORDER BY 
        c.date DESC, c.start_time DESC, p.full_name ASC;
END;
$$;

-- Garantir que a função é executável pelos utilizadores autenticados
GRANT EXECUTE ON FUNCTION public.get_recent_attendances(integer, uuid, text, uuid) TO authenticated;
