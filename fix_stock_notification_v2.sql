-- ============================================================
-- FIX V2: Reparar variant_id nos pedidos + Trigger robusto
-- Data: 2026-04-23
-- ============================================================

-- ============================================================
-- PARTE 1: Reparar os store_order_items com variant_id = NULL
-- ============================================================

-- Ver quais pedidos especiais precisam de reparação
SELECT soi.id AS item_id, soi.order_id, soi.product_id, soi.variant_id,
       so.notes,
       -- Extrair size e color das notes
       SPLIT_PART(REPLACE(so.notes, 'encomenda_especial | ', ''), ' - ', 1) AS expected_size,
       SPLIT_PART(REPLACE(so.notes, 'encomenda_especial | ', ''), ' - ', 2) AS expected_color
FROM store_order_items soi
JOIN store_orders so ON so.id = soi.order_id
WHERE soi.variant_id IS NULL
  AND so.notes ILIKE 'encomenda_especial%'
  AND so.status = 'pendente';

-- Reparar automaticamente: associar o variant_id correto baseado em product_id + size + color
UPDATE store_order_items soi
SET variant_id = spv.id
FROM store_orders so, store_product_variants spv
WHERE soi.order_id = so.id
  AND so.notes ILIKE 'encomenda_especial%'
  AND so.status = 'pendente'
  AND soi.variant_id IS NULL
  AND spv.product_id = soi.product_id
  AND spv.size = TRIM(SPLIT_PART(REPLACE(so.notes, 'encomenda_especial | ', ''), ' - ', 1))
  AND spv.color = TRIM(SPLIT_PART(REPLACE(so.notes, 'encomenda_especial | ', ''), ' - ', 2));

-- Verificar reparação
SELECT soi.id, soi.variant_id, so.notes, spv.size, spv.color, spv.stock_quantity
FROM store_order_items soi
JOIN store_orders so ON so.id = soi.order_id
LEFT JOIN store_product_variants spv ON spv.id = soi.variant_id
WHERE so.notes ILIKE 'encomenda_especial%'
  AND so.status = 'pendente';

-- ============================================================
-- PARTE 2: Trigger melhorado com fallback por product_id
-- ============================================================

DROP TRIGGER IF EXISTS tr_notify_on_stock_restock ON public.store_product_variants;
DROP FUNCTION IF EXISTS public.notify_on_stock_restock();

CREATE OR REPLACE FUNCTION public.notify_on_stock_restock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_product_name    TEXT;
    v_size            TEXT;
    v_color           TEXT;
    v_user_id         UUID;
    v_order_id        UUID;
    v_request_detail  TEXT;
    v_school_id       UUID;
    v_count           INT := 0;
    v_supabase_url    TEXT;
    v_service_key     TEXT;
BEGIN
    -- Só actua quando o stock passa de 0 (ou negativo/NULL) para > 0
    IF (OLD.stock_quantity IS NOT NULL AND OLD.stock_quantity > 0) THEN
        RETURN NEW;
    END IF;
    IF (NEW.stock_quantity IS NULL OR NEW.stock_quantity <= 0) THEN
        RETURN NEW;
    END IF;

    -- Obter o nome do produto
    SELECT name INTO v_product_name
    FROM store_products
    WHERE id = NEW.product_id;

    IF v_product_name IS NULL THEN
        RETURN NEW;
    END IF;

    v_size  := COALESCE(NEW.size, '');
    v_color := COALESCE(NEW.color, '');

    IF v_size <> '' AND v_color <> '' THEN
        v_request_detail := v_size || ' - ' || v_color;
    ELSIF v_size <> '' THEN
        v_request_detail := v_size;
    ELSIF v_color <> '' THEN
        v_request_detail := v_color;
    ELSE
        v_request_detail := 'Tamanho/Cor padrão';
    END IF;

    -- Encontrar pedidos especiais: match por variant_id OU por product_id+size+color
    FOR v_user_id, v_order_id, v_school_id IN
        SELECT DISTINCT so.user_id, so.id, so.school_id
        FROM store_orders so
        INNER JOIN store_order_items soi ON soi.order_id = so.id
        WHERE so.status = 'pendente'
          AND so.notes ILIKE 'encomenda_especial%'
          AND (
              -- Match direto por variant_id
              soi.variant_id = NEW.id
              OR
              -- Fallback: match por product_id + size/color nas notes
              (
                  soi.product_id = NEW.product_id
                  AND soi.variant_id IS NULL
                  AND so.notes ILIKE '%' || COALESCE(NEW.size, '') || '%'
                  AND so.notes ILIKE '%' || COALESCE(NEW.color, '') || '%'
              )
          )
    LOOP
        -- Criar aviso privado
        BEGIN
            INSERT INTO announcements (
                title, content, type, author_id, target_user_id, school_id
            ) VALUES (
                '🛍️ Artigo Disponível: ' || COALESCE(v_product_name, 'Artigo'),
                'O artigo que pediste (' || COALESCE(v_product_name, 'artigo') || ' — ' || v_request_detail || ') está agora disponível em stock! Acede às tuas Encomendas para o converter numa encomenda formal.',
                'system',
                v_user_id,
                v_user_id,
                v_school_id
            );
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[STOCK_NOTIFY] Erro INSERT aviso: %', SQLERRM;
        END;

        -- Tentar reparar o variant_id se estiver NULL
        BEGIN
            UPDATE store_order_items soi
            SET variant_id = NEW.id
            FROM store_orders so
            WHERE soi.order_id = so.id
              AND so.id = v_order_id
              AND soi.variant_id IS NULL
              AND soi.product_id = NEW.product_id;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

        -- Push notification
        BEGIN
            SELECT decrypted_secret INTO v_service_key
            FROM vault.decrypted_secrets
            WHERE name = 'supabase_service_role_key' LIMIT 1;

            IF v_service_key IS NOT NULL THEN
                v_supabase_url := 'https://cbbxlhdscqckqwuxbbuz.supabase.co';
                PERFORM net.http_post(
                    url     := v_supabase_url || '/functions/v1/send-push-notification',
                    headers := jsonb_build_object(
                        'Content-Type',  'application/json',
                        'Authorization', 'Bearer ' || v_service_key
                    ),
                    body    := jsonb_build_object(
                        'userId',  v_user_id::TEXT,
                        'title',   '🛍️ ' || COALESCE(v_product_name, 'Artigo') || ' disponível!',
                        'body',    'O teu pedido de ' || v_request_detail || ' está agora disponível.',
                        'url',     '/minhas-encomendas'
                    )
                );
            END IF;
        EXCEPTION WHEN OTHERS THEN NULL;
        END;

    END LOOP;

    RETURN NEW;
END;
$$;

CREATE TRIGGER tr_notify_on_stock_restock
    AFTER UPDATE OF stock_quantity
    ON store_product_variants
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_stock_restock();

-- ============================================================
-- VERIFICAÇÃO FINAL
-- ============================================================
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE trigger_name = 'tr_notify_on_stock_restock';
