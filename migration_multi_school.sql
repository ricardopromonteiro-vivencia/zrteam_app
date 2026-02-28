-- 🥋 Migração Multi-Escola e Reestruturação de Tabelas
-- Autor: Monteirismo

-- 1. Criar Tabela de Escolas
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    radius_meters INTEGER NOT NULL DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Inserir Escolas Iniciais (Coordenadas aproximadas - o Admin poderá ajustar no mapa)
INSERT INTO public.schools (name, latitude, longitude)
VALUES 
    ('Póvoa de Varzim', 41.3833, -8.7667),
    ('Fafe', 41.4500, -8.1667),
    ('Esposende', 41.5333, -8.7833),
    ('Trofa', 41.3333, -8.5833)
ON CONFLICT (name) DO NOTHING;

-- 3. Atualizar a Tabela de Perfis
-- Adicionar school_id e date_of_birth
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS date_of_birth DATE;

-- Normalizar dados existentes para evitar falhas no CHECK constraint
-- Converte femininos para os valores da nova lista (Branco, Azul, Roxo, Marrom, Preto)
UPDATE public.profiles SET belt = 'Branco' WHERE belt = 'Branca';
UPDATE public.profiles SET belt = 'Roxo' WHERE belt = 'Roxa';
UPDATE public.profiles SET belt = 'Preto' WHERE belt = 'Preta';

-- Remover NFC UID (Conforme solicitado)
ALTER TABLE public.profiles DROP COLUMN IF EXISTS nfc_uid;

-- Atualizar o CHECK constraint da faixa (Belt)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_belt_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_belt_check CHECK (belt IN (
    'Cinza/ branco', 'Cinza', 'Cinza/ Preto',
    'Amarelo / Branco', 'Amarelo', 'Amarelo/ preto',
    'Laranja/ Branco', 'Laranja', 'Laranja/ preto',
    'Verde / Branco', 'Verde', 'Verde / Preto',
    'Branco', 'Azul', 'Roxo', 'Marrom', 'Preto',
    'Coral', 'Vermelha' -- Mantemos estas para compatibilidade se sobrarem registros
));

-- 4. Atualizar a Tabela de Aulas (Classes) para pertencerem a uma escola
ALTER TABLE public.classes ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES public.schools(id);

-- 5. Atualizar o Trigger de Novo Utilizador
-- Agora aceita school_id e date_of_birth dos metadados sugeridos no registo
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, school_id, date_of_birth, belt)
  VALUES (
    new.id, 
    new.raw_user_meta_data->>'full_name', 
    COALESCE(new.raw_user_meta_data->>'role', 'Atleta'),
    (new.raw_user_meta_data->>'school_id')::UUID,
    (new.raw_user_meta_data->>'date_of_birth')::DATE,
    COALESCE(new.raw_user_meta_data->>'belt', 'Branco')
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Atualizar a Função de Check-In Seguro (Janela de 30min antes e depois)
CREATE OR REPLACE FUNCTION public.secure_checkin(
    p_lat FLOAT,
    p_lng FLOAT,
    p_client_ip TEXT
)
RETURNS JSONB AS $$
DECLARE
    v_user_id UUID;
    v_profile RECORD;
    v_school RECORD;
    v_distance FLOAT;
    v_booking RECORD;
    v_now TIMESTAMP WITH TIME ZONE;
BEGIN
    v_now := now();
    v_user_id := auth.uid();
    
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sessão expirada.');
    END IF;

    -- Obter perfil e escola do utilizador
    SELECT p.* INTO v_profile FROM public.profiles p WHERE p.id = v_user_id;
    SELECT s.* INTO v_school FROM public.schools s WHERE s.id = v_profile.school_id;

    IF v_school IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Escola não associada ao perfil.');
    END IF;

    -- Validar Proximidade Baseada na Escola do Aluno
    v_distance := public.calculate_distance(p_lat, p_lng, v_school.latitude, v_school.longitude);
    IF v_distance > v_school.radius_meters THEN
        RETURN jsonb_build_object('success', false, 'error', 'Demasiado longe da escola ' || v_school.name || '.');
    END IF;

    -- Procurar aula ativa (janela de 30min antes e 30min depois)
    SELECT cb.id, c.title, c.start_time 
    INTO v_booking
    FROM public.class_bookings cb
    JOIN public.classes c ON cb.class_id = c.id
    WHERE cb.user_id = v_user_id
      AND cb.status = 'Marcado'
      AND c.date = CURRENT_DATE
      -- Nova janela de tempo: 30min antes do início até 30min após o fim (está implícito na reserva da aula)
      AND (v_now >= (c.date + c.start_time - interval '30 minutes'))
      AND (v_now <= (c.date + c.end_time + interval '30 minutes'))
    LIMIT 1;

    IF v_booking IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Sem reserva ativa ou fora do horário de check-in.');
    END IF;

    -- Registar presença
    UPDATE public.class_bookings SET status = 'Presente', updated_at = v_now WHERE id = v_booking.id;
    UPDATE public.profiles SET attended_classes = attended_classes + 1 WHERE id = v_user_id;

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Check-in realizado com sucesso!',
        'class_title', v_booking.title
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Ativar RLS nas escolas
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Escolas visíveis por todos os autenticados" ON public.schools FOR SELECT USING (true);
CREATE POLICY "Apenas Admin gere escolas" ON public.schools FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')
);
