-- ==============================================================================
-- FIX ADICIONAL: Garantir created_by = utilizador autenticado no INSERT
-- O trigger preenche automaticamente created_by com auth.uid() se a app
-- não o enviar, OU se o valor enviado não for o utilizador logado.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_set_class_created_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se o cron criou a aula (auth.uid() = NULL), mantém o created_by da app
    -- Se foi um utilizador, FORÇA sempre o created_by = utilizador autenticado
    IF auth.uid() IS NOT NULL THEN
        NEW.created_by := auth.uid();
    END IF;
    RETURN NEW;
END;
$$;

-- Remover trigger anterior se existir
DROP TRIGGER IF EXISTS tr_set_class_created_by ON public.classes;

-- Disparar ANTES do INSERT para que o valor seja corrigido antes de ser guardado
CREATE TRIGGER tr_set_class_created_by
    BEFORE INSERT ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_set_class_created_by();

-- Verificar que o trigger foi criado:
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_table = 'classes'
ORDER BY trigger_name;
