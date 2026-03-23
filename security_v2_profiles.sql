-- ==============================================================================
-- 🥋 SEGURANÇA V2: PROTEÇÃO DE ROLE E COLUNAS ADMINISTRATIVAS
-- Regras:
-- 1. Apenas Admins podem mudar o 'role'.
-- 2. Utilizadores podem mudar faixa, graus e escola no seu próprio perfil (Personal Area).
-- 3. Utilizadores NÃO podem mudar colunas administrativas (role, aulas, etc) de si mesmos.
-- 4. Professores podem editar outros da mesma escola, mas NÃO podem mudar o 'role'.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_protect_profile_fields_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_caller_id UUID := auth.uid();
    v_caller_role TEXT;
BEGIN
    -- 1. Se não houver utilizador autenticado, permitir (triggers do sistema)
    IF v_caller_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- 2. Obter o papel (role) do chamador
    SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;

    -- 3. Se for ADMIN, permissão total
    IF v_caller_role = 'Admin' THEN
        RETURN NEW;
    END IF;

    -- 4. REGRA GLOBAL: Ninguém (exceto Admin) muda o ROLE de ninguém
    IF NEW.role IS DISTINCT FROM OLD.role THEN
        RAISE EXCEPTION 'Não tens permissão para alterar papéis (roles) de utilizadores.';
    END IF;

    -- 5. Se estiver a atualizar o PRÓPRIO perfil (SELF-UPDATE)
    IF OLD.id = v_caller_id THEN
        
        -- Bloquear colunas administrativas (NÃO estão na área pessoal)
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

        -- Nota: Faixa (belt), Graus (degrees) e Escola (school_id) SÃO permitidos aqui
        -- conforme solicitado pelo utilizador.
    END IF;

    -- 6. Se estiver a atualizar OUTRO perfil (OTHERS)
    -- Os professores podem editar alunos e outros profs da escola.
    -- O 'role' já está bloqueado na regra global acima.
    -- O RLS já restringe a atualização para a mesma escola.

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Aplicar o Trigger
DROP TRIGGER IF EXISTS tr_protect_profile_fields_v2 ON public.profiles;
CREATE TRIGGER tr_protect_profile_fields_v2
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_protect_profile_fields_v2();

-- ==============================================================================
-- 🥋 AJUSTE DE RLS PARA PERMISSÕES ESPECÍFICAS
-- ==============================================================================

-- Remover políticas antigas para evitar conflitos
DROP POLICY IF EXISTS "Utilizadores atualizam o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Admins gerem todos os perfis" ON public.profiles;
DROP POLICY IF EXISTS "Profs Resp gerem atletas da sua escola" ON public.profiles;
DROP POLICY IF EXISTS "Atleta atualiza o próprio perfil" ON public.profiles;

-- 1. Utilizador atualiza o seu próprio registo
CREATE POLICY "RLS_SELF_UPDATE" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. Admin faz tudo
CREATE POLICY "RLS_ADMIN_ALL" ON public.profiles
    FOR ALL USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin' );

-- 3. Professores e Profs Responsáveis editam outros da mesma escola
-- (O trigger bloqueia a mudança de role)
CREATE POLICY "RLS_PROFS_UPDATE_OTHERS" ON public.profiles
    FOR UPDATE
    USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Professor', 'Professor Responsável')
        AND school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid())
    );
