-- ==============================================================================
-- 🥋 ADD SYNCHRONIZED CLOUD COLUMN: class_name in class_bookings
-- ==============================================================================

-- 1. Adicionar o campo à tabela (permitindo NULL inicialmente para o UPDATE)
ALTER TABLE public.class_bookings 
ADD COLUMN IF NOT EXISTS class_name TEXT;

-- 2. Preencher os dados existentes com base no class_id
UPDATE public.class_bookings cb
SET class_name = c.title
FROM public.classes c
WHERE cb.class_id = c.id
AND cb.class_name IS NULL;

-- 3. Função para sincronizar o nome ao inserir ou trocar a aula da reserva
CREATE OR REPLACE FUNCTION public.fn_sync_booking_class_name()
RETURNS TRIGGER AS $$
BEGIN
    SELECT title INTO NEW.class_name 
    FROM public.classes 
    WHERE id = NEW.class_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger na tabela class_bookings (BEFORE INSERT OR UPDATE)
DROP TRIGGER IF EXISTS tr_sync_booking_class_name ON public.class_bookings;
CREATE TRIGGER tr_sync_booking_class_name
BEFORE INSERT OR UPDATE OF class_id ON public.class_bookings
FOR EACH ROW EXECUTE FUNCTION public.fn_sync_booking_class_name();

-- 5. Função para sincronizar as reservas caso o nome da aula mude na tabela classes
CREATE OR REPLACE FUNCTION public.fn_sync_class_title_to_bookings()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.class_bookings 
    SET class_name = NEW.title 
    WHERE class_id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 6. Trigger na tabela classes (AFTER UPDATE of title)
DROP TRIGGER IF EXISTS tr_sync_class_title_to_bookings ON public.classes;
CREATE TRIGGER tr_sync_class_title_to_bookings
AFTER UPDATE OF title ON public.classes
FOR EACH ROW 
WHEN (OLD.title IS DISTINCT FROM NEW.title)
EXECUTE FUNCTION public.fn_sync_class_title_to_bookings();
