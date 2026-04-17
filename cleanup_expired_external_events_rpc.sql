-- ==============================================================================
-- FUNÇÃO: cleanup_expired_external_events
-- Elimina eventos externos cuja data já passou (< data atual).
-- Usa SECURITY DEFINER para que qualquer utilizador autenticado possa
-- chamar esta função, garantindo limpeza automática ao carregar o Dashboard.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_external_events()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.external_events
  WHERE event_date < CURRENT_DATE;
$$;

-- Permissão de execução para utilizadores autenticados
GRANT EXECUTE ON FUNCTION public.cleanup_expired_external_events() TO authenticated;

-- ==============================================================================
-- VERIFICAÇÃO: Ver eventos atualmente expirados antes de limpar
-- SELECT id, name, event_date FROM external_events WHERE event_date < CURRENT_DATE;
-- ==============================================================================
