-- ==============================================================================
-- 🔐 CORREÇÃO DE SEGURANÇA: Function Search Path Mutable
-- Este script resolve os avisos do Supabase sobre funções que não definiam
-- explicitamente o search_path, mitigando possíveis vulnerabilidades de segurança.
-- ==============================================================================

-- 1. Sincronização do nome da aula na reserva
CREATE OR REPLACE FUNCTION public.fn_sync_booking_class_name()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    SELECT title INTO NEW.class_name 
    FROM public.classes 
    WHERE id = NEW.class_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Sincronização de título modificado de aula para reservas
CREATE OR REPLACE FUNCTION public.fn_sync_class_title_to_bookings()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    UPDATE public.class_bookings 
    SET class_name = NEW.title 
    WHERE class_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Abate e Reposição de Stock em encomendas da Loja
CREATE OR REPLACE FUNCTION public.handle_order_stock_update()
RETURNS TRIGGER 
SET search_path = public
AS $$
BEGIN
    -- Se a encomenda muda para 'pago', descontar stock
    IF (TG_OP = 'UPDATE' AND OLD.status != 'pago' AND NEW.status = 'pago') THEN
        UPDATE public.store_product_variants v
        SET stock_quantity = stock_quantity - i.quantity
        FROM public.store_order_items i
        WHERE i.order_id = NEW.id AND i.variant_id = v.id;
    END IF;

    -- Se a encomenda muda de 'pago' para outra coisa (cancelado/reembolsado), repor stock
    IF (TG_OP = 'UPDATE' AND OLD.status = 'pago' AND NEW.status != 'pago') THEN
        UPDATE public.store_product_variants v
        SET stock_quantity = stock_quantity + i.quantity
        FROM public.store_order_items i
        WHERE i.order_id = NEW.id AND i.variant_id = v.id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
