-- ==============================================================================
-- MIGRAÇÃO: Objetivo Mensal de Treino
-- Data: 2026-03-13
-- Descrição: Adiciona coluna monthly_goal à tabela profiles para guardar
--            o objetivo mensal de aulas do atleta de forma persistente.
-- ==============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS monthly_goal integer DEFAULT NULL;

-- DESC: Valor NULL significa que o atleta ainda não definiu um objetivo.
--       O atleta pode alterar o seu objetivo a qualquer momento.
