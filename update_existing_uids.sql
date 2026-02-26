-- 1. Gerar UIDs para todos os utilizadores que ainda não têm um
UPDATE public.profiles
SET nfc_uid = substr(md5(random()::text), 1, 8)
WHERE nfc_uid IS NULL;

-- 2. Clarificação: A tabela 'class_bookings' já regista as presenças.
-- Quando o utilizador faz check-in, o estado muda de 'Marcado' para 'Presente'.
-- Podes ver isto no teu SQL Editor.

COMMENT ON TABLE class_bookings IS 'Tabela que une Atletas a Aulas e regista Presenças (status = Presente)';
