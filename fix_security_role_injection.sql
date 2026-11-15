-- ==============================================================================
-- CORREÇÃO DE SEGURANÇA: handle_new_user — ignorar role do cliente
-- Problema: o campo `role` passado pelo browser no raw_user_meta_data
--           poderia ser manipulado por um utilizador técnico para tentar
--           registar-se como 'Admin' ou 'Professor'.
-- Solução: o trigger fixa sempre 'Atleta' independentemente do que vier
--          no registo, garantindo que nenhum utilizador se auto-promove.
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    full_name,
    role,          -- SEMPRE 'Atleta', nunca confiamos no valor do cliente
    school_id,
    date_of_birth,
    belt,
    email,
    needs_validation
  )
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    'Atleta',      -- Fixo: promoção de roles só pode ser feita por Admin/Professor
    (new.raw_user_meta_data->>'school_id')::UUID,
    (new.raw_user_meta_data->>'date_of_birth')::DATE,
    COALESCE(new.raw_user_meta_data->>'belt', 'Branco'),
    new.email,
    true           -- Sempre requer validação por Admin/Professor
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

