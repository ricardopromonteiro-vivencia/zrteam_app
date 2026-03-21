-- ==============================================================================
-- 🥋 PREVENÇÃO DE DUPLICADOS (NOME + DATA NASCIMENTO)
-- Garante que não existem dois utilizadores com o mesmo nome e data de nascimento.
-- ==============================================================================

-- 1. Adicionar o constrangimento UNIQUE
ALTER TABLE public.profiles 
ADD CONSTRAINT unique_name_dob UNIQUE (full_name, date_of_birth);
