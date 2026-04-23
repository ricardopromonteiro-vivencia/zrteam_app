-- ============================================================
-- RLS: Permitir utilizadores apagar os seus pedidos especiais
-- ============================================================

-- Política de DELETE: utilizadores podem apagar os seus próprios pedidos
-- pendentes que sejam encomendas especiais
DROP POLICY IF EXISTS "Users can delete own pending special orders" ON public.store_orders;
CREATE POLICY "Users can delete own pending special orders"
    ON public.store_orders FOR DELETE
    USING (
        auth.uid() = user_id
        AND status = 'pendente'
        AND notes ILIKE 'encomenda_especial%'
    );

-- Verificação
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'store_orders';
