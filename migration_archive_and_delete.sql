-- ============================================================
-- MIGRATION: Arquivo de Atletas + Apagar Utilizador do Auth
-- ============================================================

-- 1. Adicionar coluna is_archived à tabela profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Criar função para apagar utilizador do Auth (apenas Admin pode usar)
--    Esta função usa SECURITY DEFINER para ter permissões de superuser
CREATE OR REPLACE FUNCTION public.delete_user_and_auth(user_id_param UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar se o utilizador que chama é Admin
  IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'Admin' THEN
    RAISE EXCEPTION 'Apenas administradores podem apagar contas.';
  END IF;

  -- Apagar o perfil (as bookings e pagamentos serão apagados em cascata se configurado)
  DELETE FROM public.profiles WHERE id = user_id_param;

  -- Apagar da tabela de autenticação
  DELETE FROM auth.users WHERE id = user_id_param;
END;
$$;

-- 3. Garantir que a RLS não bloqueia a função (SECURITY DEFINER ultrapassa RLS)
GRANT EXECUTE ON FUNCTION public.delete_user_and_auth(UUID) TO authenticated;

-- ============================================================
-- VERIFICAÇÃO: Após correr, verifica:
-- SELECT column_name FROM information_schema.columns 
--   WHERE table_name = 'profiles' AND column_name = 'is_archived';
-- ============================================================
