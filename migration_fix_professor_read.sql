-- ============================================================
-- FIX: Allow reading Professor and Admin profiles
-- This ensures the JOINS (like assigned_professor_id) work 
-- for everyone, avoiding get_my_role() issues.
-- ============================================================

CREATE POLICY "Everyone can read professors and admins"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING (
        role IN ('Professor', 'Professor Responsável', 'Admin')
    );
