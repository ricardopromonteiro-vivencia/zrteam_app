-- ==============================================================================
-- PROFESSOR AUXILIAR (SEGUNDO PROFESSOR) NAS AULAS
-- ==============================================================================
-- Adiciona um professor opcional secundário à aula, que também terá acesso
-- à gestão de check-ins dessa mesma aula na aplicação.
-- ==============================================================================

-- 1. Adicionar second_professor_id à tabela classes
ALTER TABLE public.classes 
ADD COLUMN IF NOT EXISTS second_professor_id UUID REFERENCES public.profiles(id) DEFAULT null;

-- 2. Atualizar as políticas da tabela classes (RLS) para garantir que o segundo professor consegue interagir se necessário.
-- NOTA: O RLS atual da tabela `classes` e `class_bookings` costuma permitir visualização a professores da escola e gestão ao criador,
-- Vamos garantir que o RLS de `class_bookings` e `classes` abrange o second_professor_id
-- Este script assume os policies base já em uso. Caso os check-ins estejam a bloquear atualizações pelo 2º professor,
-- adiciona uma policy explícita (só corre se Policy CheckIn não cobrir).

CREATE OR REPLACE FUNCTION is_second_professor_of_class(class_id_param UUID, user_id_param UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.classes 
    WHERE id = class_id_param AND second_professor_id = user_id_param
  );
$$;
