-- ==============================================================================
-- 🥋 DISABLE AUTO PROMOTION (MANUAL GRADUATIONS ONLY)
-- Redefine as funções de presença para garantir que NÃO há promoções automáticas.
-- O professor deve gerir a cor da faixa e os graus manualmente no menu "Atletas".
-- ==============================================================================

-- 1. Redefinir incremento de aulas (Sem promoções automáticas)
CREATE OR REPLACE FUNCTION public.increment_attended_classes(user_id_param UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET attended_classes = attended_classes + 1 
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Redefinir decremento de aulas (Sem promoções automáticas)
CREATE OR REPLACE FUNCTION public.decrement_attended_classes(user_id_param UUID)
RETURNS void AS $$
BEGIN
    UPDATE public.profiles 
    SET attended_classes = GREATEST(0, attended_classes - 1)
    WHERE id = user_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
