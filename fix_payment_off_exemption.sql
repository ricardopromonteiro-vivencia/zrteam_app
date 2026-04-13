-- ============================================================
-- FIX: Escolas com payment_management_enabled = false
-- Atletas dessas escolas devem estar isentos de restrições
-- e não receber notificações de pagamento
-- ============================================================

-- 1. Ver triggers existentes relacionados com pagamentos
SELECT trigger_name, event_manipulation, event_object_table, action_statement
FROM information_schema.triggers
WHERE trigger_name ILIKE '%payment%'
   OR trigger_name ILIKE '%pagamento%'
   OR trigger_name ILIKE '%mensalidade%';

-- 2. Ver funções que referenciam pagamento/payment e envio de notificações
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_definition ILIKE '%payment%'
   OR routine_definition ILIKE '%pagamento%'
   OR routine_definition ILIKE '%send-push%'
   OR routine_definition ILIKE '%push_subscriptions%';

-- 3. Se existir alguma função/trigger que envia push para atletas com pagamento pendente,
--    adicionar esta condição de verificação antes de enviar:
--
--    -- Verificar se a escola do atleta tem payment_management_enabled = false
--    SELECT s.payment_management_enabled
--    INTO v_payment_off
--    FROM profiles p
--    JOIN schools s ON s.id = p.school_id
--    WHERE p.id = athlete_id;
--
--    -- Se payment_off, não enviar notificação e não bloquear
--    IF v_payment_off = false THEN
--        RETURN; -- sair sem fazer nada
--    END IF;

-- 4. Garantir que atletas de escolas com payment off aparecem como "Pago" 
--    (inserir pagamento automático mensal) — OPCIONAL, apenas se necessário:
--
-- INSERT INTO payments (athlete_id, month, year, status, school_id)
-- SELECT p.id, EXTRACT(MONTH FROM NOW())::int, EXTRACT(YEAR FROM NOW())::int, 'Pago', p.school_id
-- FROM profiles p
-- JOIN schools s ON s.id = p.school_id
-- WHERE s.payment_management_enabled = false
--   AND p.role = 'Atleta'
--   AND NOT EXISTS (
--     SELECT 1 FROM payments pay
--     WHERE pay.athlete_id = p.id
--       AND pay.month = EXTRACT(MONTH FROM NOW())::int
--       AND pay.year = EXTRACT(YEAR FROM NOW())::int
--   );
