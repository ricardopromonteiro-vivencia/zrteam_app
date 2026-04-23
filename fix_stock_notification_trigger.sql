-- ============================================================
-- FIX: Trigger de Notificação de Stock Corrigido
-- Data: 2026-04-23
-- Problema: O trigger anterior não estava a inserir avisos
-- ============================================================

-- 1. Dropar o trigger e função antigos
DROP TRIGGER IF EXISTS tr_notify_on_stock_restock ON public.store_product_variants;
DROP FUNCTION IF EXISTS public.notify_on_stock_restock();

-- 2. Recriar a função com tratamento de erros robusto
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
    -- Só actua quando o stock passa de 0 (ou negativo) para > 0
    IF (OLD.stock_quantity IS NOT NULL AND OLD.stock_quantity > 0) THEN
        -- Stock já era positivo, não é reposição
        RETURN NEW;
    END IF;

    IF (NEW.stock_quantity IS NULL OR NEW.stock_quantity <= 0) THEN
        -- Stock novo continua sem stock
        RETURN NEW;
    END IF;

    -- Neste ponto: OLD.stock_quantity <= 0 (ou NULL) E NEW.stock_quantity > 0
    RAISE NOTICE '[STOCK_NOTIFY] Reposição detetada: variant_id=%, old_stock=%, new_stock=%',
        NEW.id, OLD.stock_quantity, NEW.stock_quantity;

    -- Obter o nome do produto
    SELECT name INTO v_product_name
    FROM public.store_products
    WHERE id = NEW.product_id;

    IF v_product_name IS NULL THEN
        RAISE NOTICE '[STOCK_NOTIFY] Produto não encontrado para product_id=%', NEW.product_id;
        RETURN NEW;
    END IF;

    v_size  := COALESCE(NEW.size, '');
    v_color := COALESCE(NEW.color, '');

    -- Construir o texto do detalhe do artigo (ex: "A1 - Branco")
    IF v_size <> '' AND v_color <> '' THEN
        v_request_detail := v_size || ' - ' || v_color;
    ELSIF v_size <> '' THEN
        v_request_detail := v_size;
    ELSIF v_color <> '' THEN
        v_request_detail := v_color;
    ELSE
        v_request_detail := 'Tamanho/Cor padrão';
    END IF;

    RAISE NOTICE '[STOCK_NOTIFY] Produto: %, Detalhe: %', v_product_name, v_request_detail;

    -- Encontrar todos os pedidos especiais pendentes para esta variante
    FOR v_user_id, v_order_id, v_school_id IN
        SELECT DISTINCT so.user_id, so.id, so.school_id
        FROM public.store_orders so
        INNER JOIN public.store_order_items soi ON soi.order_id = so.id
        WHERE so.status = 'pendente'
          AND so.notes ILIKE 'encomenda_especial%'
          AND soi.variant_id = NEW.id
    LOOP
        RAISE NOTICE '[STOCK_NOTIFY] Encontrado pedido especial: order_id=%, user_id=%, school_id=%',
            v_order_id, v_user_id, v_school_id;

        -- Criar aviso na tabela announcements (aviso privado para este utilizador)
        BEGIN
            INSERT INTO public.announcements (
                title,
                content,
                type,
                author_id,
                target_user_id,
                school_id
            ) VALUES (
                '🛍️ Artigo Disponível: ' || COALESCE(v_product_name, 'Artigo'),
                'O artigo que pediste (' || COALESCE(v_product_name, 'artigo') || ' — ' || v_request_detail || ') está agora disponível em stock! Acede às tuas Encomendas para o converter numa encomenda formal.',
                'system',
                v_user_id,
                v_user_id,
                v_school_id
            );

            v_count := v_count + 1;
            RAISE NOTICE '[STOCK_NOTIFY] ✅ Aviso criado com sucesso para user_id=%', v_user_id;

        EXCEPTION WHEN OTHERS THEN
            RAISE WARNING '[STOCK_NOTIFY] ❌ Erro ao inserir aviso para user_id=%: %', v_user_id, SQLERRM;
        END;

        -- Tentar enviar push notification via Edge Function
        BEGIN
            -- Obter URL e chave do Supabase via vault (mesmo método do trigger de eventos)
            SELECT decrypted_secret INTO v_service_key
            FROM vault.decrypted_secrets
            WHERE name = 'supabase_service_role_key'
            LIMIT 1;

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
                        'body',    'O teu pedido de ' || v_request_detail || ' está agora disponível. Clica para encomendar.',
                        'url',     '/minhas-encomendas'
                    )
                );
                RAISE NOTICE '[STOCK_NOTIFY] Push notification enviada para user_id=%', v_user_id;
            ELSE
                RAISE NOTICE '[STOCK_NOTIFY] Vault key não encontrada, push notification ignorada';
            END IF;

        EXCEPTION WHEN OTHERS THEN
            -- Se a push notification falhar, continua sem erro
            RAISE NOTICE '[STOCK_NOTIFY] Push falhou (não crítico): %', SQLERRM;
        END;

    END LOOP;

    IF v_count = 0 THEN
        RAISE NOTICE '[STOCK_NOTIFY] Nenhum pedido especial pendente encontrado para variant_id=%', NEW.id;
    ELSE
        RAISE NOTICE '[STOCK_NOTIFY] Total de avisos criados: %', v_count;
    END IF;

    RETURN NEW;
END;
$$;

-- 3. Criar o trigger
CREATE TRIGGER tr_notify_on_stock_restock
    AFTER UPDATE OF stock_quantity
    ON public.store_product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_stock_restock();

-- ============================================================
-- VERIFICAÇÃO: Confirmar que o trigger foi criado
-- ============================================================
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing
FROM information_schema.triggers
WHERE trigger_name = 'tr_notify_on_stock_restock';

-- ============================================================
-- GARANTIR RLS correcta para avisos automáticos
-- ============================================================

-- A policy de SELECT já deve estar correcta, mas garantir
DROP POLICY IF EXISTS "Users can view own or public announcements" ON public.announcements;
CREATE POLICY "Users can view own or public announcements"
    ON public.announcements FOR SELECT
    USING (
        -- Aviso público (sem utilizador alvo)
        (target_user_id IS NULL)
        OR
        -- Aviso privado endereçado especificamente a este utilizador
        (target_user_id = auth.uid())
        OR
        -- Admin vê tudo
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Admin'
        )
    );

-- ============================================================
-- TESTE RÁPIDO (descomenta para testar manualmente)
-- ============================================================
/*
-- 1. Ver pedidos especiais pendentes e as suas variantes:
SELECT so.id AS order_id, so.user_id, so.notes, so.school_id,
       soi.variant_id, spv.stock_quantity, sp.name AS product_name
FROM store_orders so
JOIN store_order_items soi ON soi.order_id = so.id
JOIN store_product_variants spv ON spv.id = soi.variant_id
JOIN store_products sp ON sp.id = spv.product_id
WHERE so.status = 'pendente'
  AND so.notes ILIKE 'encomenda_especial%'
ORDER BY so.created_at DESC;

-- 2. Se houver resultados, copia o variant_id e testa o update:
-- (substitui UUID-AQUI pelo variant_id real)

-- Primeiro, garante stock = 0:
-- UPDATE store_product_variants SET stock_quantity = 0 WHERE id = 'UUID-AQUI';

-- Depois, repõe stock para disparar o trigger:
-- UPDATE store_product_variants SET stock_quantity = 5 WHERE id = 'UUID-AQUI';

-- 3. Verificar se o aviso foi criado:
-- SELECT id, title, target_user_id, school_id, created_at
-- FROM announcements WHERE type = 'system' ORDER BY created_at DESC LIMIT 5;
*/
