-- Adicionar coluna is_hidden à tabela profiles
-- Um utilizador com is_hidden = true não aparece em NENHUMA lista (atletas, pagamentos, check-in, etc.)
-- mas mantém acesso total ao sistema (incluindo acesso Admin)
-- Para ativar: UPDATE public.profiles SET is_hidden = true WHERE id = '<user-uuid>';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_hidden boolean DEFAULT false;
