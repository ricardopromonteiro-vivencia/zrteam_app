-- ==============================================================================
-- PROFESSORES GLOBAIS (Taça de Prata / Super Professores)
-- ==============================================================================
-- Adiciona a capacidade de um perfil ser marcado como 'is_global_professor'.
-- Estes professores aparecem nas listas de escolas / opções de aulas de TODAS as escolas.
-- ==============================================================================

-- 1. Adicionar o boolean na tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_global_professor BOOLEAN DEFAULT false;

-- 2. Indexarmos esta coluna opcionalmente para pesquisas mais rápidas em turmas grandes
CREATE INDEX IF NOT EXISTS idx_is_global_prof ON public.profiles(is_global_professor) WHERE is_global_professor = true;
