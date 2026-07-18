-- ==============================================================================
-- 🔒 CORREÇÃO DE AVISOS DE SEGURANÇA DO SUPABASE — 2026-07
-- Corre este script no SQL Editor do Supabase
--
-- Avisos corrigidos:
--   1. function_search_path_mutable          → 2 funções
--   2. public_bucket_allows_listing          → bucket store_products
--   3. anon_security_definer_function_executable   → revogar acesso anon
--   4. authenticated_security_definer_function_executable → revogar acesso
--      de utilizadores autenticados a funções internas (triggers, crons)
--
-- IGNORADO (conforme indicado): Leaked Password Protection Disabled
-- ==============================================================================


-- ==============================================================================
-- PARTE 1: SEARCH_PATH MUTABLE
-- Adicionar SET search_path às funções que não o tinham
-- ==============================================================================

ALTER FUNCTION public.check_email_exists_secure(p_email text)
  SET search_path = public;

ALTER FUNCTION public.notify_grade_change_request()
  SET search_path = public;


-- ==============================================================================
-- PARTE 2: BUCKET PÚBLICO COM LISTAGEM PERMISSIVA
-- O bucket store_products é público — as imagens funcionam via URL sem política.
-- Restringimos o SELECT apenas a autenticados para impedir listagem anónima.
-- ==============================================================================

DROP POLICY IF EXISTS "Public Access Store" ON storage.objects;

CREATE POLICY "Public Access Store"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'store_products');


-- ==============================================================================
-- PARTE 3: REVOGAR EXECUTE DO ROLE 'anon' EM FUNÇÕES QUE NÃO PRECISAM
--
-- check_email_exists_secure: MANTÉM acesso anon (usada no registo antes de login)
-- Todas as outras: revogar do anon (só devem ser chamadas por autenticados ou internamente)
-- ==============================================================================

-- Funções de trigger (internas — nunca chamadas via RPC)
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_validation()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_push_on_announcement()        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_push_on_validation()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_grade_change_request()        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_class_audit()                     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_notify_new_external_event()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_protect_profile_fields_v2()       FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.fn_set_class_created_by()            FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_assign_head_professor_role()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_demote_head_professor_role()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_profile_to_auth()               FROM anon, authenticated;

-- Funções de cron/agendamento (internas — chamadas apenas pelo pg_cron)
REVOKE EXECUTE ON FUNCTION public.check_and_notify_pending_payments()  FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_external_events()    FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stock_announcement()         FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.delete_old_class_announcements()     FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.process_recurring_classes()          FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                    FROM anon, authenticated;

-- Funções helpers de RLS (usadas internamente pelo postgres nas políticas RLS)
REVOKE EXECUTE ON FUNCTION public.get_auth_role()                      FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_auth_school_id()                 FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_role()                        FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_second_professor_of_class(uuid, uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_validated()                       FROM anon, authenticated;

-- Funções RPC chamadas apenas por utilizadores autenticados — revogar só do anon
REVOKE EXECUTE ON FUNCTION public.approve_grade_change(uuid, text)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_grade_change(uuid, text)      FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_own_user()                    FROM anon;
REVOKE EXECUTE ON FUNCTION public.delete_user_and_auth(uuid)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_absent_athletes(integer, uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_recent_attendances(integer, uuid, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.secure_checkin(double precision, double precision, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_user(uuid)                  FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_attended_classes(uuid)     FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrement_attended_classes(uuid)     FROM anon;

-- notify_on_stock_restock: também trigger interno
REVOKE EXECUTE ON FUNCTION public.notify_on_stock_restock()            FROM anon, authenticated;


-- ==============================================================================
-- PARTE 4: GARANTIR EXECUTE CORRETO PARA AS FUNÇÕES NECESSÁRIAS
--
-- Funções chamadas via RPC pelo frontend (utilizadores autenticados precisam)
-- Re-grant explícito para o role 'authenticated' nas funções RPC do app:
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.approve_grade_change(uuid, text)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_grade_change(uuid, text)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_user()                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_and_auth(uuid)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_absent_athletes(integer, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_attendances(integer, uuid, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_checkin(double precision, double precision, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_user(uuid)                   TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_attended_classes(uuid)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_attended_classes(uuid)      TO authenticated;

-- check_email_exists_secure: necessita de anon (usada no ecrã de registo antes de login)
GRANT EXECUTE ON FUNCTION public.check_email_exists_secure(text)       TO anon;

-- ==============================================================================
-- FIM ✅
-- Nota: O aviso "Leaked Password Protection Disabled" foi ignorado.
-- ==============================================================================
