-- ==============================================================================
-- 🥋 SISTEMA DE MEDALHAS
-- Adiciona colunas para registo de medalhas (Ouro, Prata, Bronze).
-- ==============================================================================

-- 1. Adicionar as colunas à tabela profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS medals_gold INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS medals_silver INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS medals_bronze INTEGER DEFAULT 0;
