-- Corrigir a segurança da View `classes_view`
-- Força a visualização a obedecer às Regras de RLS do utilizador (Security Invoker) 
-- em vez do criador da view (Security Definer).

ALTER VIEW public.classes_view SET (security_invoker = on);
