-- ==============================================================================
-- 🥋 FIX VALIDATION RPC PERMISSIONS
-- Permite que o Professor Responsável valide e rejeite atletas da sua escola.
-- ==============================================================================

-- 1. Função para validar utilizador
CREATE OR REPLACE FUNCTION public.validate_user(target_user_id UUID)
RETURNS void AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_school_id UUID;
    v_target_school_id UUID;
BEGIN
    -- Obter info do chamador
    SELECT role, school_id INTO v_caller_role, v_caller_school_id 
    FROM public.profiles WHERE id = auth.uid();

    -- Obter escola do alvo
    SELECT school_id INTO v_target_school_id 
    FROM public.profiles WHERE id = target_user_id;

    -- Verificar permissão
    IF v_caller_role = 'Admin' OR 
       (v_caller_role = 'Professor Responsável' AND v_caller_school_id = v_target_school_id) THEN
        
        UPDATE public.profiles 
        SET needs_validation = false 
        WHERE id = target_user_id;
    ELSE
        RAISE EXCEPTION 'Apenas Administradores ou Professores Responsáveis da mesma escola podem validar atletas.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Função para apagar utilizador e auth (rejeição)
CREATE OR REPLACE FUNCTION public.delete_user_and_auth(user_id_param UUID)
RETURNS void AS $$
DECLARE
    v_caller_role TEXT;
    v_caller_school_id UUID;
    v_target_school_id UUID;
BEGIN
    -- Obter info do chamador
    SELECT role, school_id INTO v_caller_role, v_caller_school_id 
    FROM public.profiles WHERE id = auth.uid();

    -- Obter escola do alvo
    SELECT school_id INTO v_target_school_id 
    FROM public.profiles WHERE id = user_id_param;

    -- Verificar permissão
    IF v_caller_role = 'Admin' OR 
       (v_caller_role = 'Professor Responsável' AND v_caller_school_id = v_target_school_id) THEN
        
        -- Apagar perfil (triggers/FKs tratam do resto em public)
        DELETE FROM public.profiles WHERE id = user_id_param;
        -- Apagar de auth.users (necessário SECURITY DEFINER para aceder a auth)
        DELETE FROM auth.users WHERE id = user_id_param;
    ELSE
        RAISE EXCEPTION 'Apenas Administradores ou Professores Responsáveis da mesma escola podem apagar atletas.';
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;
