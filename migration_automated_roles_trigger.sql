-- ==============================================================================
-- AUTOMAÇÃO DE ROLES: PROFESSOR RESPONSÁVEL
-- ==============================================================================
-- Este script resolve definitivamente o problema do "Professor Responsável".
-- Sempre que um Administrador for à aba "Escolas" e selecionar um Professor 
-- como Responsável de uma Escola, a Base de Dados vai automaticamente:
-- 1. Promover esse utilizador a "Professor Responsável".
-- 2. IGNORAR se o utilizador já for um "Admin" (protegendo a tua conta suprema!)
-- ==============================================================================

-- 1. Criar a função que o Trigger vai usar
CREATE OR REPLACE FUNCTION public.auto_assign_head_professor_role()
RETURNS TRIGGER AS $$
DECLARE
    v_current_role TEXT;
BEGIN
    -- Se foi atribuído um novo Professor Responsável
    IF NEW.head_professor_id IS NOT NULL THEN
        
        -- Descobrir qual é o role atual desse utilizador
        SELECT role INTO v_current_role 
        FROM public.profiles 
        WHERE id = NEW.head_professor_id;

        -- Só o vamos promover a 'Professor Responsável' SE ele não for Admin.
        -- Se for 'Admin', ele já tem poder máximo, não lhe tocamos!
        IF v_current_role != 'Admin' AND v_current_role != 'Professor Responsável' THEN
            UPDATE public.profiles 
            SET role = 'Professor Responsável' 
            WHERE id = NEW.head_professor_id;
            
            -- Também atualizamos o Auth para refletir a mudança
            UPDATE auth.users 
            SET raw_user_meta_data = jsonb_set(
                COALESCE(raw_user_meta_data, '{}'::jsonb),
                '{role}',
                '"Professor Responsável"'
            )
            WHERE id = NEW.head_professor_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Eliminar o trigger se já existir para limpar a casa
DROP TRIGGER IF EXISTS on_school_head_professor_change ON public.schools;

-- 3. Criar o Trigger que fica à escuta de mudanças na aba "Escolas"
CREATE TRIGGER on_school_head_professor_change
AFTER INSERT OR UPDATE OF head_professor_id
ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.auto_assign_head_professor_role();

-- ==============================================================================
-- Opcional: E se tirarmos o Professor da escola? Ele devia voltar a 'Professor' normal.
-- (Este código assegura isso, desde que ele não seja diretor de *outras* escolas)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.auto_demote_head_professor_role()
RETURNS TRIGGER AS $$
DECLARE
    v_is_still_head BOOLEAN;
    v_current_role TEXT;
BEGIN
    -- Se havia um professor associado antes desta mudança e ele agora saiu desta escola
    IF OLD.head_professor_id IS NOT NULL AND (NEW.head_professor_id IS NULL OR NEW.head_professor_id != OLD.head_professor_id) THEN
        
        -- Descobrir qual é o role atual do antigo professor responsável
        SELECT role INTO v_current_role 
        FROM public.profiles 
        WHERE id = OLD.head_professor_id;

        -- Só mexemos nele se ele atualmente for 'Professor Responsável'
        IF v_current_role = 'Professor Responsável' THEN
            -- Vamos verificar se por acaso ele ainda é Diretor de OUTRA escola
            SELECT EXISTS (
                SELECT 1 FROM public.schools WHERE head_professor_id = OLD.head_professor_id
            ) INTO v_is_still_head;

            -- Se ele já não liderar nenhuma academia, voltamos a torná-lo 'Professor' normal
            IF NOT v_is_still_head THEN
                UPDATE public.profiles 
                SET role = 'Professor' 
                WHERE id = OLD.head_professor_id;
                
                UPDATE auth.users 
                SET raw_user_meta_data = jsonb_set(
                    COALESCE(raw_user_meta_data, '{}'::jsonb),
                    '{role}',
                    '"Professor"'
                )
                WHERE id = OLD.head_professor_id;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Eliminar trigger de demissão se já existir
DROP TRIGGER IF EXISTS on_school_head_professor_remove ON public.schools;

-- 5. Criar trigger de despromoção quando o professor é retirado
CREATE TRIGGER on_school_head_professor_remove
AFTER UPDATE OF head_professor_id OR DELETE
ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.auto_demote_head_professor_role();
