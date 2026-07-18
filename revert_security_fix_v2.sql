-- ==============================================================================
-- 🔄 REVERSÃO COMPLETA — fix_security_warnings_v2.sql
-- Corre este script IMEDIATAMENTE no SQL Editor do Supabase para restaurar login
-- ==============================================================================

-- Restaurar EXECUTE para PUBLIC em todas as funções que foram revogadas
-- (estado original — as funções voltam a funcionar normalmente)

-- Triggers
GRANT EXECUTE ON FUNCTION public.handle_new_user()                 TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.handle_new_user_validation()      TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_push_on_announcement()     TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_push_on_validation()       TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_grade_change_request()     TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_class_audit()                  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_notify_new_external_event()    TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_protect_profile_fields_v2()    TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.fn_set_class_created_by()         TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_assign_head_professor_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_demote_head_professor_role() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_profile_to_auth()            TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.notify_on_stock_restock()         TO PUBLIC;

-- Crons
GRANT EXECUTE ON FUNCTION public.check_and_notify_pending_payments()   TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_external_events()     TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stock_announcement()          TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_old_class_announcements()      TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_recurring_classes()           TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rls_auto_enable()                     TO PUBLIC;

-- Helpers de RLS (CRÍTICOS — usados nas políticas RLS das tabelas)
GRANT EXECUTE ON FUNCTION public.get_auth_role()                           TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_auth_school_id()                      TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_role()                             TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_second_professor_of_class(uuid, uuid)  TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_validated()                            TO PUBLIC;

-- Funções RPC
GRANT EXECUTE ON FUNCTION public.approve_grade_change(uuid, text)                             TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.reject_grade_change(uuid, text)                              TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_own_user()                                            TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_user_and_auth(uuid)                                   TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_absent_athletes(integer, uuid, text, uuid)               TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_recent_attendances(integer, uuid, text, uuid)            TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.secure_checkin(double precision, double precision, text, uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_user(uuid)                                          TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_attended_classes(uuid)                             TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.decrement_attended_classes(uuid)                             TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_email_exists_secure(text)                              TO PUBLIC;

-- ==============================================================================
-- ✅ REVERSÃO COMPLETA — tudo restaurado ao estado original
-- ==============================================================================
