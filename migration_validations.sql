-- ============================================================
-- MIGRATION: Campo needs_validation no profiles
-- ============================================================

-- Adicionar coluna needs_validation à tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS needs_validation BOOLEAN NOT NULL DEFAULT FALSE;

-- Trigger para preencher automaticamente needs_validation=true para novos utilizadores
-- que se registem com role Atleta
CREATE OR REPLACE FUNCTION public.handle_new_user_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se o novo utilizador tem role Atleta, marca como pendente de validação
  IF NEW.role = 'Atleta' THEN
    NEW.needs_validation := TRUE;
  END IF;
  RETURN NEW;
END;
$$;

-- Aplicar trigger ao INSERT em profiles
DROP TRIGGER IF EXISTS on_profile_created_set_validation ON public.profiles;
CREATE TRIGGER on_profile_created_set_validation
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_validation();

-- Função RPC para validar um utilizador (apenas Admin ou Professor Responsável da escola)
CREATE OR REPLACE FUNCTION public.validate_user(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  caller_role TEXT;
  caller_school UUID;
  target_school UUID;
  caller_school_head UUID;
BEGIN
  -- Obter dados do utilizador que chama
  SELECT role, school_id INTO caller_role, caller_school
  FROM public.profiles WHERE id = auth.uid();

  -- Admin pode validar qualquer utilizador
  IF caller_role = 'Admin' THEN
    UPDATE public.profiles SET needs_validation = FALSE WHERE id = target_user_id;
    RETURN;
  END IF;

  -- Professor Responsável: só pode validar atletas da sua escola
  IF caller_role = 'Professor' AND caller_school IS NOT NULL THEN
    -- Verificar se é professor responsável da escola
    SELECT head_professor_id INTO caller_school_head
    FROM public.schools WHERE id = caller_school;

    IF caller_school_head = auth.uid() THEN
      -- Verificar que o atleta pertence à mesma escola
      SELECT school_id INTO target_school
      FROM public.profiles WHERE id = target_user_id;

      IF target_school = caller_school THEN
        UPDATE public.profiles SET needs_validation = FALSE WHERE id = target_user_id;
        RETURN;
      ELSE
        RAISE EXCEPTION 'Não podes validar atletas de outra escola.';
      END IF;
    END IF;
  END IF;

  RAISE EXCEPTION 'Não tens permissão para validar este atleta.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_user(UUID) TO authenticated;
