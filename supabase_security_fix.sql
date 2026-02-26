-- 🛡️ Reforço de Segurança Sugerido pelo Supabase Advisor
-- Autor: Monteirismo

-- 1. Definir search_path fixo para funções de segurança (evita search path hijacking)
-- Isto resolve o aviso "Function Search Path Mutable"

ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.increment_attended_classes(p_user_id UUID) SET search_path = public;
ALTER FUNCTION public.decrement_attended_classes(p_user_id UUID) SET search_path = public;
ALTER FUNCTION public.calculate_distance(lat1 FLOAT, lon1 FLOAT, lat2 FLOAT, lon2 FLOAT) SET search_path = public;
ALTER FUNCTION public.secure_checkin(p_lat FLOAT, p_lng FLOAT, p_client_ip TEXT) SET search_path = public;

-- 2. Nota sobre "Leaked Password Protection":
-- Este aviso deve ser resolvido nas definições do Supabase Dashoard em:
-- Authentication > Settings > Password Protection > Enable "Check for leaked passwords"

-- 3. Nota sobre "RLS disabled":
-- Recomenda-se ativar RLS em todas as tabelas. Já ativámos em 'academy_config'.
-- As outras tabelas têm políticas básicas, mas o Advisor sugere uma revisão completa se houver novos dados sensíveis.
