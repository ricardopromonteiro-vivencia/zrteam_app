-- ============================================================
-- FIX: Permitir leitura pública de perfis de Professores e Admins
-- para o formulário de registo poder popular a lista dinamicamente
-- ============================================================

-- Remover política anterior se a nova precisar de substituir
DROP POLICY IF EXISTS "Anyone can read Professor and Admin profiles" ON public.profiles;

-- Política de leitura que permite a qualquer pessoa (mesmo não autenticada)
-- ler APENAS os perfis de Professores e Admins.
-- Isto é seguro porque não expõe dados críticos e é necessário no registo.
CREATE POLICY "Anyone can read Professor and Admin profiles"
  ON public.profiles
  FOR SELECT
  USING (
    role IN ('Admin', 'Professor')
  );
