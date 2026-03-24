-- ==============================================================================
-- CORREÇÃO: RLS Loja — substituir EXISTS(profiles) por get_auth_role()
-- Problema: As políticas de store_orders e store_order_items fazem SELECT
-- direto em `profiles`, que agora tem RLS mais restritivo após emergency_rls_fix.
-- Solução: usar a função SECURITY DEFINER get_auth_role() já existente.
-- ==============================================================================

-- ─── store_categories ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view categories" ON public.store_categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.store_categories;
DROP POLICY IF EXISTS "store_cat_select_all" ON public.store_categories;
DROP POLICY IF EXISTS "store_cat_admin_all" ON public.store_categories;

CREATE POLICY "store_cat_select_all"
ON public.store_categories FOR SELECT USING (true);

CREATE POLICY "store_cat_admin_all"
ON public.store_categories FOR ALL
USING (public.get_auth_role() = 'Admin');

-- ─── store_products ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view products" ON public.store_products;
DROP POLICY IF EXISTS "Admins can manage products" ON public.store_products;
DROP POLICY IF EXISTS "store_prod_select_all" ON public.store_products;
DROP POLICY IF EXISTS "store_prod_admin_all" ON public.store_products;

CREATE POLICY "store_prod_select_all"
ON public.store_products FOR SELECT USING (true);

CREATE POLICY "store_prod_admin_all"
ON public.store_products FOR ALL
USING (public.get_auth_role() = 'Admin');

-- ─── store_product_variants ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can view variants" ON public.store_product_variants;
DROP POLICY IF EXISTS "Admins can manage variants" ON public.store_product_variants;
DROP POLICY IF EXISTS "store_var_select_all" ON public.store_product_variants;
DROP POLICY IF EXISTS "store_var_admin_all" ON public.store_product_variants;

CREATE POLICY "store_var_select_all"
ON public.store_product_variants FOR SELECT USING (true);

CREATE POLICY "store_var_admin_all"
ON public.store_product_variants FOR ALL
USING (public.get_auth_role() = 'Admin');

-- ─── store_orders ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own orders" ON public.store_orders;
DROP POLICY IF EXISTS "Users can insert orders" ON public.store_orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.store_orders;
DROP POLICY IF EXISTS "store_ord_select" ON public.store_orders;
DROP POLICY IF EXISTS "store_ord_insert" ON public.store_orders;
DROP POLICY IF EXISTS "store_ord_update_admin" ON public.store_orders;
DROP POLICY IF EXISTS "store_ord_delete_admin" ON public.store_orders;

-- Utilizador vê as próprias encomendas; Admin vê todas
CREATE POLICY "store_ord_select"
ON public.store_orders FOR SELECT
USING (
    auth.uid() = user_id
    OR public.get_auth_role() = 'Admin'
    OR public.get_auth_role() IN ('Professor', 'Professor Responsável')
);

-- Qualquer utilizador autenticado pode inserir a sua própria encomenda
CREATE POLICY "store_ord_insert"
ON public.store_orders FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Apenas Admin atualiza estado da encomenda
CREATE POLICY "store_ord_update_admin"
ON public.store_orders FOR UPDATE
USING (public.get_auth_role() = 'Admin');

-- Apenas Admin pode apagar encomendas
CREATE POLICY "store_ord_delete_admin"
ON public.store_orders FOR DELETE
USING (public.get_auth_role() = 'Admin');

-- ─── store_order_items ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own order items" ON public.store_order_items;
DROP POLICY IF EXISTS "Users can insert order items" ON public.store_order_items;
DROP POLICY IF EXISTS "store_items_select" ON public.store_order_items;
DROP POLICY IF EXISTS "store_items_insert" ON public.store_order_items;

-- Utilizador vê os itens das próprias encomendas; Admin/Prof vê todos
CREATE POLICY "store_items_select"
ON public.store_order_items FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.store_orders o
        WHERE o.id = order_id
          AND (
              o.user_id = auth.uid()
              OR public.get_auth_role() = 'Admin'
              OR public.get_auth_role() IN ('Professor', 'Professor Responsável')
          )
    )
);

-- Utilizador insere os seus próprios itens
CREATE POLICY "store_items_insert"
ON public.store_order_items FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.store_orders o
        WHERE o.id = order_id AND o.user_id = auth.uid()
    )
);
