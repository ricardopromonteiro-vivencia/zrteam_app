-- ==============================================================================
-- ORDENAÇÃO HIERÁRQUICA DAS ESCOLAS
-- ==============================================================================
-- Permite atribuir um número de prioridade (order_index) a cada escola, 
-- para que estas surjam nos menus e pautas segundo a hierarquia principal em vez de
-- ordem alfabética.
-- ==============================================================================

ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS order_index INTEGER DEFAULT 99;

-- Opcional: Indexar para queries que puxam tudo ordenado
CREATE INDEX IF NOT EXISTS idx_school_order_index ON public.schools(order_index, name);
