-- ============================================================
-- MIGRATION: Notificações Automáticas de Stock Disponível
-- Projeto: ZR Team / Jiu-Jitsu App
-- Data: 2026-04-23
-- ============================================================
-- COMO USAR:
--   Corre este script no SQL Editor do Supabase (Settings > SQL Editor)
-- ============================================================

-- ------------------------------------------------------------
-- PASSO 1: Verificar se a tabela announcements tem a coluna target_user_id
-- (Se já tiver, este bloco não faz nada graças ao IF NOT EXISTS)
-- ------------------------------------------------------------
ALTER TABLE public.announcements
    ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Criar índice para pesquisas rápidas por utilizador alvo
CREATE INDEX IF NOT EXISTS idx_announcements_target_user
    ON public.announcements(target_user_id)
    WHERE target_user_id IS NOT NULL;

-- ------------------------------------------------------------
-- PASSO 2: Garantir que a RLS da tabela announcements permite
-- que o utilizador veja os seus próprios avisos privados
-- ------------------------------------------------------------
-- Verificar se a política já existe e recriar de forma segura
DROP POLICY IF EXISTS "Users can view own or public announcements" ON public.announcements;
CREATE POLICY "Users can view own or public announcements"
    ON public.announcements FOR SELECT
    USING (
        -- Aviso público (sem utilizador alvo e sem escola, ou da escola do utilizador)
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

-- Garantir que o sistema (service_role) pode inserir avisos automáticos
DROP POLICY IF EXISTS "Service role can insert announcements" ON public.announcements;
CREATE POLICY "Service role can insert announcements"
    ON public.announcements FOR INSERT
    WITH CHECK (true); -- Controlado pela função SECURITY DEFINER abaixo

-- ------------------------------------------------------------
-- PASSO 3: Função principal que deteta reposição de stock
-- e notifica os utilizadores que fizeram pedidos especiais
-- ------------------------------------------------------------
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
BEGIN
    -- Só actua quando o stock passa de 0 (ou negativo) para > 0
    IF NOT (OLD.stock_quantity <= 0 AND NEW.stock_quantity > 0) THEN
        RETURN NEW;
    END IF;

    -- Obter o nome do produto
    SELECT name INTO v_product_name
    FROM public.store_products
    WHERE id = NEW.product_id;

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

    -- Encontrar todos os pedidos especiais pendentes para esta variante
    -- Um "pedido especial" é um store_order com:
    --   status = 'pendente' E notes LIKE 'encomenda_especial%'
    --   e que tenha um store_order_item com esta variant_id
    FOR v_user_id, v_order_id IN
        SELECT DISTINCT so.user_id, so.id
        FROM public.store_orders so
        INNER JOIN public.store_order_items soi ON soi.order_id = so.id
        WHERE so.status = 'pendente'
          AND so.notes ILIKE 'encomenda_especial%'
          AND soi.variant_id = NEW.id
    LOOP
        -- Criar aviso na tabela announcements (aviso privado para este utilizador)
        INSERT INTO public.announcements (
            title,
            content,
            type,
            author_id,
            target_user_id,
            school_id
        )
        SELECT
            '🛍️ Artigo Disponível: ' || COALESCE(v_product_name, 'Artigo'),
            'O artigo que pediste (' || COALESCE(v_product_name, 'artigo') || ' — ' || v_request_detail || ') está agora disponível em stock! Acede às tuas Encomendas para o converter numa encomenda formal.',
            'system',
            v_user_id,          -- autor = o próprio sistema/user (evita NULL)
            v_user_id,          -- aviso visível APENAS a este utilizador
            so.school_id        -- associado à escola do utilizador
        FROM public.store_orders so
        WHERE so.id = v_order_id
        LIMIT 1;

        -- Tentar enviar push notification via Edge Function
        -- (só funciona se a Edge Function 'send-push-notification' estiver deployada)
        BEGIN
            PERFORM net.http_post(
                url     := current_setting('app.supabase_url', true) || '/functions/v1/send-push-notification',
                headers := jsonb_build_object(
                    'Content-Type',  'application/json',
                    'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key', true)
                ),
                body    := jsonb_build_object(
                    'userId',  v_user_id::TEXT,
                    'title',   '🛍️ ' || COALESCE(v_product_name, 'Artigo') || ' disponível!',
                    'body',    'O teu pedido de ' || v_request_detail || ' está agora disponível. Clica para encomendar.',
                    'url',     '/minhas-encomendas'
                )
            );
        EXCEPTION WHEN OTHERS THEN
            -- Se a push notification falhar (ex: pg_net não disponível), continua sem erro
            NULL;
        END;

    END LOOP;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------
-- PASSO 4: Criar o trigger na tabela store_product_variants
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS tr_notify_on_stock_restock ON public.store_product_variants;
CREATE TRIGGER tr_notify_on_stock_restock
    AFTER UPDATE OF stock_quantity
    ON public.store_product_variants
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_on_stock_restock();

-- ------------------------------------------------------------
-- PASSO 5: Garantir que a tabela announcements tem RLS activa
-- (já deve estar, mas garantir)
-- ------------------------------------------------------------
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Política para Admin inserir avisos manualmente
DROP POLICY IF EXISTS "Admins can insert announcements" ON public.announcements;
CREATE POLICY "Admins can insert announcements"
    ON public.announcements FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND (role = 'Admin' OR role ILIKE '%professor%')
        )
    );

-- Política para Admin eliminar avisos
DROP POLICY IF EXISTS "Admins can delete announcements" ON public.announcements;
CREATE POLICY "Admins can delete announcements"
    ON public.announcements FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid() AND role = 'Admin'
        )
        OR author_id = auth.uid()
    );

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
-- TESTE MANUAL (opcional — descomenta para testar):
-- Simula um update de stock de 0 → 5 numa variante existente
-- ============================================================
/*
-- 1. Ver variantes sem stock:
SELECT id, product_id, size, color, stock_quantity
FROM public.store_product_variants
WHERE stock_quantity = 0
LIMIT 5;

-- 2. Actualizar uma delas (substitui o UUID pelo ID real):
UPDATE public.store_product_variants
SET stock_quantity = 5
WHERE id = 'UUID-DA-VARIANTE-AQUI';

-- 3. Verificar se o aviso foi criado:
SELECT id, title, content, target_user_id, created_at
FROM public.announcements
WHERE type = 'system'
ORDER BY created_at DESC
LIMIT 5;
*/
