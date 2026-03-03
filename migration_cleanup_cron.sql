-- 1. Activar a extensão pg_cron (caso não esteja ativa)
create extension if not exists pg_cron;

-- 2. Limpar qualquer job antigo com o mesmo nome (apenas se existir)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cleanup-daily-announcements') THEN
        PERFORM cron.unschedule('cleanup-daily-announcements');
    END IF;
END $$;

-- 3. Criar a função que faz a limpeza dos avisos
CREATE OR REPLACE FUNCTION delete_old_class_announcements()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Opção A: Eliminar apenas avisos gerados automaticamente pelo sistema (sobre aulas)
  -- que foram criados antes do dia de hoje (ou seja, à meia-noite apaga os de ontem)
  DELETE FROM public.announcements 
  WHERE created_by = 'Sistema' 
    AND created_at < current_date;

  -- Opção B: (Descomentar se quiseres apagar TODOS os avisos mais antigos que 24h)
  -- DELETE FROM public.announcements WHERE created_at < NOW() - INTERVAL '1 day';
END;
$$;

-- 4. Agendar a função para correr todos os dias à meia-noite (00:00)
-- A sintaxe cron é: minuto hora dia_do_mês mês dia_da_semana
SELECT cron.schedule(
    'cleanup-daily-announcements',
    '0 0 * * *', -- Todos os dias às 00:00
    $$SELECT delete_old_class_announcements()$$
);

-- ==========================================
-- DICA: Se a tua framework não tiver 'Sistema' definido no author/created_by,
-- podes adaptar o WHERE clause acima.
-- ==========================================
