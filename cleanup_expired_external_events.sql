-- =============================================================
-- LIMPEZA AUTOMÁTICA DE EVENTOS EXTERNOS EXPIRADOS
-- Executa no Supabase SQL Editor
-- =============================================================

-- Opção 1: Executar manualmente para limpar eventos passados agora
DELETE FROM external_events
WHERE event_date < CURRENT_DATE;

-- =============================================================
-- Opção 2: Criar cron job diário para limpeza automática (requer extensão pg_cron)
-- Verifica se pg_cron está disponível antes de executar
-- =============================================================

-- Ativar extensão pg_cron (apenas disponível no plano Pro ou superior do Supabase)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Agendar limpeza diária às 00:05 (UTC)
-- SELECT cron.schedule(
--   'limpar-eventos-externos-expirados',  -- nome único do job
--   '5 0 * * *',                          -- cron: todos os dias às 00:05 UTC
--   $$
--     DELETE FROM external_events
--     WHERE event_date < CURRENT_DATE;
--   $$
-- );

-- =============================================================
-- Verificar jobs agendados (se pg_cron estiver ativo)
-- =============================================================
-- SELECT * FROM cron.job;

-- =============================================================
-- Remover job (se necessário)
-- =============================================================
-- SELECT cron.unschedule('limpar-eventos-externos-expirados');

-- =============================================================
-- NOTA: A app já faz limpeza automática ao carregar o Dashboard.
-- Este ficheiro é apenas para limpeza manual ou via cron.
-- =============================================================
