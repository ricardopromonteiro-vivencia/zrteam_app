-- ============================================================
-- Trigger: Limpar aviso de stock quando pedido especial
-- é eliminado ou cancelado (pelo admin ou utilizador)
-- ============================================================

CREATE OR REPLACE FUNCTION public.cleanup_stock_announcement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_detail TEXT;
BEGIN
    -- Só actua em pedidos especiais
    IF OLD.notes IS NULL OR OLD.notes NOT ILIKE 'encomenda_especial%' THEN
        RETURN OLD;
    END IF;

    -- Extrair o detalhe (ex: "M0000 - Branco")
    v_detail := REPLACE(OLD.notes, 'encomenda_especial | ', '');

    -- Apagar avisos de stock correspondentes
    DELETE FROM announcements
    WHERE target_user_id = OLD.user_id
      AND type = 'system'
      AND content ILIKE '%' || v_detail || '%';

    RETURN OLD;
END;
$$;

-- Trigger BEFORE DELETE (quando alguém apaga o pedido)
DROP TRIGGER IF EXISTS tr_cleanup_stock_announcement_delete ON public.store_orders;
CREATE TRIGGER tr_cleanup_stock_announcement_delete
    BEFORE DELETE ON public.store_orders
    FOR EACH ROW
    EXECUTE FUNCTION public.cleanup_stock_announcement();

-- Trigger BEFORE UPDATE (quando admin cancela o pedido)
DROP TRIGGER IF EXISTS tr_cleanup_stock_announcement_cancel ON public.store_orders;
CREATE TRIGGER tr_cleanup_stock_announcement_cancel
    BEFORE UPDATE ON public.store_orders
    FOR EACH ROW
    WHEN (OLD.status = 'pendente' AND NEW.status = 'cancelado')
    EXECUTE FUNCTION public.cleanup_stock_announcement();

-- Verificação
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name LIKE 'tr_cleanup_stock%';
