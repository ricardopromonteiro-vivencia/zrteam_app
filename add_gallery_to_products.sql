-- Adicionar suporte para múltiplas imagens na tabela de produtos
ALTER TABLE public.store_products
ADD COLUMN IF NOT EXISTS gallery_urls TEXT[] DEFAULT '{}';
