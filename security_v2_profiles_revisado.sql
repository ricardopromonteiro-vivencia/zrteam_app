-- ==============================================================================
-- 🥋 SEGURANÇA V2 (REVISADO): PROTEÇÃO DE ROLE E COLUNAS ADMINISTRATIVAS
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_protect_profile_fields_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
BEGIN
    -- 1. Triggers internos sem contexto de auth
    IF v_caller_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Obter papel do chamador
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    -- 3. ADMIN tem permissão total
    IF v_caller_role = 'Admin' THEN
        RETURN NEW;
    END IF;

    -- 4. REGRA: Apenas Admins podem mudar o ROLE (em si mesmos ou nos outros)
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Não tens permissão para alterar o papel (role). Esta ação requer privilégios de Administrador.';
    END IF;

    -- 5. Se estiver a atualizar o PRÓPRIO perfil
    IF OLD.id = v_caller_id THEN
        -- Bloquear colunas administrativas (como solicitado pelo utilizador: role e extras que não estão na área pessoal)
        -- Faixa (belt), Graus (degrees) e Escola (school_id) SÃO permitidos.
        
        IF NEW.attended_classes IS DISTINCT FROM OLD.attended_classes THEN
            RAISE EXCEPTION 'Não podes manipular o teu próprio contador de aulas.';
        END IF;

        IF NEW.is_global_professor IS DISTINCT FROM OLD.is_global_professor THEN
            RAISE EXCEPTION 'Permissão negada para alterar o estatuto global.';
        END IF;

        IF NEW.is_archived IS DISTINCT FROM OLD.is_archived OR 
           NEW.needs_validation IS DISTINCT FROM OLD.needs_validation OR
           NEW.is_hidden IS DISTINCT FROM OLD.is_hidden THEN
            RAISE EXCEPTION 'Não podes alterar o teu estado administrativo.';
        END IF;
    END IF;

    -- 6. Professores editando outros na mesma escola
    -- O 'role' já está garantido no ponto 4.
    -- O RLS garante que são da mesma escola.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Garantir que o trigger de criação automática de perfil não seja bloqueado por este trigger (auth.uid é nulo)
DROP TRIGGER IF EXISTS tr_protect_profile_fields_v2 ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields_v2
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_protect_profile_fields_v2();

-- ==============================================================================
-- 🥋 REFORÇO DE RLS V2
-- ==============================================================================

DROP POLICY IF EXISTS "Utilizadores atualizam o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins gerem todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Profs Resp gerem atletas da sua escola" ON public.profiles;
DROP POLICY IF EXISTS "Atleta atualiza o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "RLS_SELF_UPDATE" ON public.profiles;
DROP POLICY IF EXISTS "RLS_ADMIN_ALL" ON public.profiles;
DROP POLICY IF EXISTS "RLS_PROFS_UPDATE_OTHERS" ON public.profiles;

-- 1. Auto-update: Qualquer um pode mudar o seu perfil (campos controlados pelo trigger)
CREATE POLICY "RLS_SELF_UPDATE" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. Admin: Faz tudo
CREATE POLICY "RLS_ADMIN_ALL" ON public.profiles
    FOR ALL USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin' );

-- 3. Professores (ambos os tipos): Gerem atletas e outros professores da escola
CREATE POLICY "RLS_PROFS_UPDATE_OTHERS" ON public.profiles
    FOR UPDATE
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Professor', 'Professor Responsável')
        AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    );
