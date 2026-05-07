-- Resolve o aviso do linter do Supabase: "security_definer_view"
-- Garante que a vista corre com as permissões de quem faz a query e não do criador.
ALTER VIEW public.v_class_audit SET (security_invoker = on);
