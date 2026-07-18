-- ==============================================================================
-- 🔒 CORREÇÃO DEFINITIVA DOS AVISOS DE SEGURANÇA — 2026-07 v2
--
-- O script anterior usou REVOKE FROM anon/authenticated, mas o PostgreSQL
-- concede EXECUTE ao role PUBLIC por defeito — e anon/authenticated herdam
-- de PUBLIC. A correção correta é: REVOKE FROM PUBLIC primeiro.
--
-- Corre este script no SQL Editor do Supabase.
-- ==============================================================================


-- ==============================================================================
-- PARTE 1: BUCKET store_products — REMOVER POLÍTICA SELECT DESNECESSÁRIA
--
-- Buckets públicos no Supabase servem ficheiros via URL pública SEM precisar
-- de qualquer política RLS. A política SELECT é redundante e causava o aviso.
-- ==============================================================================

DROP POLICY IF EXISTS "Public Access Store" ON storage.objects;

-- Nota: as imagens da loja continuam acessíveis via URL pública do bucket.
-- Não é necessária nenhuma política SELECT num bucket público.


-- ==============================================================================
-- PARTE 2: REVOGAR EXECUTE DO ROLE PUBLIC EM TODAS AS FUNÇÕES INTERNAS
--
-- Depois de REVOKE FROM PUBLIC, re-grant apenas para os roles corretos.
-- ==============================================================================

-- ── Funções de trigger (nunca chamadas via RPC) ──
REVOKE EXECUTE ON FUNCTION public.handle_new_user()                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_validation()      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_push_on_announcement()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_push_on_validation()       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_grade_change_request()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_class_audit()                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_notify_new_external_event()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_protect_profile_fields_v2()    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.fn_set_class_created_by()         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_assign_head_professor_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.auto_demote_head_professor_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sync_profile_to_auth()            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_on_stock_restock()         FROM PUBLIC;

-- ── Funções de cron/agendamento (chamadas apenas pelo pg_cron/sistema) ──
REVOKE EXECUTE ON FUNCTION public.check_and_notify_pending_payments()   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_expired_external_events()     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cleanup_stock_announcement()          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_old_class_announcements()      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.process_recurring_classes()           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()                     FROM PUBLIC;

-- ── Helpers internos de RLS (chamados pelo postgres, não via RPC) ──
REVOKE EXECUTE ON FUNCTION public.get_auth_role()                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_auth_school_id()                      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_my_role()                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_second_professor_of_class(uuid, uuid)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_validated()                            FROM PUBLIC;


-- ==============================================================================
-- PARTE 3: REVOGAR EXECUTE DO ROLE PUBLIC NAS FUNÇÕES RPC DO APP
-- e re-grant APENAS para o role 'authenticated'
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.approve_grade_change(uuid, text)                            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reject_grade_change(uuid, text)                             FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_own_user()                                           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.delete_user_and_auth(uuid)                                  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_absent_athletes(integer, uuid, text, uuid)              FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_recent_attendances(integer, uuid, text, uuid)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.secure_checkin(double precision, double precision, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_user(uuid)                                         FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_attended_classes(uuid)                            FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrement_attended_classes(uuid)                            FROM PUBLIC;

-- Re-grant apenas para authenticated (necessário para o app funcionar)
GRANT EXECUTE ON FUNCTION public.approve_grade_change(uuid, text)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_grade_change(uuid, text)                             TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_user()                                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_and_auth(uuid)                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_absent_athletes(integer, uuid, text, uuid)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_recent_attendances(integer, uuid, text, uuid)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.secure_checkin(double precision, double precision, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_user(uuid)                                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_attended_classes(uuid)                            TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_attended_classes(uuid)                            TO authenticated;


-- ==============================================================================
-- PARTE 4: check_email_exists_secure — REVOGAR PUBLIC, MANTER anon
--
-- Esta função precisa de ser chamada ANTES do login (ecrã de registo),
-- por isso o role 'anon' necessita de EXECUTE.
-- No entanto, o aviso do linter vai continuar a aparecer para 'anon'
-- porque isso é INTENCIONAL. Os avisos de 'authenticated' são eliminados.
-- ==============================================================================

REVOKE EXECUTE ON FUNCTION public.check_email_exists_secure(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_email_exists_secure(text) TO anon, authenticated;

-- NOTA: O aviso "anon can execute check_email_exists_secure" é ESPERADO e aceitável —
-- esta função só verifica se um email existe (retorna boolean), não expõe dados sensíveis.


-- ==============================================================================
-- FIM ✅
-- Nota: O aviso "Leaked Password Protection Disabled" foi ignorado.
-- ==============================================================================
