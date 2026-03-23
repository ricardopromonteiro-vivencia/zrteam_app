-- ESQUEMA DE BASE DE DADOS PARA A LOJA (STORE)

-- 1. Categorias de Produtos
CREATE TABLE IF NOT EXISTS public.store_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Produtos
CREATE TABLE IF NOT EXISTS public.store_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    category_id UUID REFERENCES public.store_categories(id) ON DELETE SET NULL,
    image_url TEXT,
    is_available BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Variantes de Produtos (Tamanho/Cor/Stock)
CREATE TABLE IF NOT EXISTS public.store_product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID REFERENCES public.store_products(id) ON DELETE CASCADE,
    size TEXT,
    color TEXT,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    UNIQUE(product_id, size, color)
);

-- 4. Encomendas
CREATE TABLE IF NOT EXISTS public.store_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pendente', -- 'pendente', 'pago', 'cancelado', 'entregue'
    total_amount DECIMAL(10,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Itens da Encomenda
CREATE TABLE IF NOT EXISTS public.store_order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.store_orders(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.store_products(id) ON DELETE SET NULL,
    variant_id UUID REFERENCES public.store_product_variants(id) ON DELETE SET NULL,
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL
);

-- ATIVAÇÃO DE RLS
ALTER TABLE public.store_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_order_items ENABLE ROW LEVEL SECURITY;

-- 6. CONFIGURAÇÃO DO STORAGE (BUCKET PARA FOTOS)
-- Nota: Executar isto no SQL Editor do Supabase cria o bucket se o esquema 'storage' estiver ativo.
INSERT INTO storage.buckets (id, name, public) 
VALUES ('store_products', 'store_products', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas para o Storage
DROP POLICY IF EXISTS "Public Access Store" ON storage.objects;
DROP POLICY IF EXISTS "Admins Manage Store Photos" ON storage.objects;

CREATE POLICY "Public Access Store" ON storage.objects FOR SELECT USING (bucket_id = 'store_products');
CREATE POLICY "Admins Manage Store Photos" ON storage.objects FOR ALL 
USING (bucket_id = 'store_products' AND (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')));

-- POLÍTICAS RLS (Resumo: Leitura para todos, Escrita para Admin)
-- Categorias/Produtos/Variantes: Todos leem, Admin escreve
DROP POLICY IF EXISTS "Anyone can view categories" ON public.store_categories;
CREATE POLICY "Anyone can view categories" ON public.store_categories FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage categories" ON public.store_categories;
CREATE POLICY "Admins can manage categories" ON public.store_categories FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

DROP POLICY IF EXISTS "Anyone can view products" ON public.store_products;
CREATE POLICY "Anyone can view products" ON public.store_products FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage products" ON public.store_products;
CREATE POLICY "Admins can manage products" ON public.store_products FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

DROP POLICY IF EXISTS "Anyone can view variants" ON public.store_product_variants;
CREATE POLICY "Anyone can view variants" ON public.store_product_variants FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admins can manage variants" ON public.store_product_variants;
CREATE POLICY "Admins can manage variants" ON public.store_product_variants FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

-- Encomendas: User vê as suas, Admin vê todas
DROP POLICY IF EXISTS "Users can view own orders" ON public.store_orders;
CREATE POLICY "Users can view own orders" ON public.store_orders FOR SELECT USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));
DROP POLICY IF EXISTS "Users can insert orders" ON public.store_orders;
CREATE POLICY "Users can insert orders" ON public.store_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins can update orders" ON public.store_orders;
CREATE POLICY "Admins can update orders" ON public.store_orders FOR UPDATE USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'));

DROP POLICY IF EXISTS "Users can view own order items" ON public.store_order_items;
CREATE POLICY "Users can view own order items" ON public.store_order_items FOR SELECT USING (EXISTS (SELECT 1 FROM public.store_orders WHERE id = order_id AND (user_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin'))));
DROP POLICY IF EXISTS "Users can insert order items" ON public.store_order_items;
CREATE POLICY "Users can insert order items" ON public.store_order_items FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.store_orders WHERE id = order_id AND user_id = auth.uid()));

-- LÓGICA DE STOCK (TRIGGER)
CREATE OR REPLACE FUNCTION public.handle_order_stock_update()
RETURNS TRIGGER AS $$
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

DROP TRIGGER IF EXISTS tr_order_stock_update ON public.store_orders;
CREATE TRIGGER tr_order_stock_update
AFTER UPDATE ON public.store_orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_order_stock_update();

-- SEED DATA (Categorias)
INSERT INTO public.store_categories (name) VALUES ('Kimonos'), ('Calções'), ('Rashguards'), ('T-shirts') ON CONFLICT DO NOTHING;

-- Função auxiliar para inserir variantes de forma mais limpa (opcional, mas vamos usar inserts diretos para compatibilidade)
DO $$
DECLARE
    kimono_id UUID;
    hiperfly_id UUID;
    calc_fem_id UUID;
    calc_masc_id UUID;
    rash_fem_id UUID;
    rash_masc_short_id UUID;
    rash_long_id UUID;
    tshirt_id UUID;
    cat_kimono UUID;
    cat_calc UUID;
    cat_rash UUID;
    cat_tshirt UUID;
BEGIN
    -- Obter IDs das categorias
    SELECT id INTO cat_kimono FROM public.store_categories WHERE name = 'Kimonos';
    SELECT id INTO cat_calc FROM public.store_categories WHERE name = 'Calções';
    SELECT id INTO cat_rash FROM public.store_categories WHERE name = 'Rashguards';
    SELECT id INTO cat_tshirt FROM public.store_categories WHERE name = 'T-shirts';

    -- 1. Kimonos
    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('Kimono CTS/ZR', cat_kimono, 85.00, 'Kimono oficial ZR Team de alta durabilidade.', true)
    RETURNING id INTO kimono_id;

    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('Kimono CTS/ ZR HIPER FLY', cat_kimono, 120.00, 'Edição especial Hiper Fly ultra leve.', true)
    RETURNING id INTO hiperfly_id;

    -- Variantes Kimono CTS/ZR (Kids & Adultos, Branco & Preto)
    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT kimono_id, size, color, 10
    FROM (SELECT unnest(ARRAY['M0000', 'M000', 'M00', 'M0', 'M1', 'M2', 'M3', 'M4', 'A1', 'A2', 'A3', 'A4']) as size) s,
         (SELECT unnest(ARRAY['Branco', 'Preto']) as color) c;

    -- Variantes Kimono Hiper Fly
    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT hiperfly_id, size, color, 5
    FROM (SELECT unnest(ARRAY['M3', 'M4', 'A1', 'A2', 'A3', 'A4']) as size) s,
         (SELECT unnest(ARRAY['Branco', 'Preto']) as color) c;

    -- 2. Calções
    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('Calções Femininos', cat_calc, 35.00, 'Calções específicos para treino feminino.', true)
    RETURNING id INTO calc_fem_id;

    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('Calções Masculinos', cat_calc, 35.00, 'Calções de alta resistência para No-Gi.', true)
    RETURNING id INTO calc_masc_id;

    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT calc_fem_id, unnest(ARRAY['XS', 'S', 'M', 'L', 'XL']), 'Padrão', 15;

    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT calc_masc_id, unnest(ARRAY['S', 'M', 'L', 'XL']), 'Padrão', 20;

    -- 3. Rashguards
    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('Rashguard Feminina', cat_rash, 40.00, 'Rashguard ajustada para competição feminina.', true)
    RETURNING id INTO rash_fem_id;

    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('Rashguard Masculino Manga Curta', cat_rash, 40.00, 'Rashguard manga curta oficial ZR Team.', true)
    RETURNING id INTO rash_masc_short_id;

    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('Rashguard Manga Longa em Cores', cat_rash, 45.00, 'Rashguard manga longa disponível em várias cores.', true)
    RETURNING id INTO rash_long_id;

    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT rash_fem_id, unnest(ARRAY['XS', 'S', 'M', 'L']), 'Padrão', 10;

    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT rash_masc_short_id, unnest(ARRAY['S', 'M', 'L', 'XL', 'XXL']), 'Padrão', 20;

    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT rash_long_id, unnest(ARRAY['S', 'M', 'L', 'XL']), 'Padrão', 15;

    -- 4. T-shirts
    INSERT INTO public.store_products (name, category_id, price, description, is_available)
    VALUES ('T-shirt ZR Team', cat_tshirt, 20.00, 'T-shirt oficial ZR Team Algodão.', true)
    RETURNING id INTO tshirt_id;

    INSERT INTO public.store_product_variants (product_id, size, color, stock_quantity)
    SELECT tshirt_id, unnest(ARRAY['XS', 'S', 'M', 'L', 'XL']), 'Preto', 30;

END $$;
