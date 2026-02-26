-- ==========================================
-- SCHEMA DA BASE DE DADOS JIUT-JITSU APP
-- Podes correr este script no SQL Editor do Supabase.
-- ==========================================

-- 1. Tabela de Perfis de Utilizadores
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    full_name TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('Admin', 'Professor', 'Atleta')) DEFAULT 'Atleta',
    belt TEXT NOT NULL DEFAULT 'Branca',
    degrees INTEGER NOT NULL DEFAULT 0,
    attended_classes INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    nfc_uid TEXT UNIQUE -- Guardar o código do cartão NFC
);

-- Ativar RLS para profiles
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilizadores podem ver o seu próprio perfil" ON profiles
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admin e Professores podem ver todos os perfis" ON profiles
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Professor')
      )
    );

CREATE POLICY "Apenas Admin podem atualizar qualquer perfil" ON profiles
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'Admin'
      )
    );

-- Trigger para criar o perfil automaticamente quando um auth.user é criado
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (new.id, new.raw_user_meta_data->>'full_name', COALESCE(new.raw_user_meta_data->>'role', 'Atleta'));
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- 2. Tabela de Aulas (Classes)
CREATE TABLE classes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    title TEXT NOT NULL,
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 30,
    professor_id UUID REFERENCES profiles(id) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver as aulas (autenticados)" ON classes
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Professores e Admin podem criar/editar aulas" ON classes
    FOR ALL USING (
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Professor')
      )
    );


-- 3. Tabela de Reservas / Presenças (Class Bookings)
CREATE TABLE class_bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('Marcado', 'Presente', 'Falta')) DEFAULT 'Marcado',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(class_id, user_id) -- Um utilizador só pode marcar uma vez a mesma aula
);

ALTER TABLE class_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Utilizadores podem ver as suas reservas" ON class_bookings
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Professores e Admin podem ver todas as reservas" ON class_bookings
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Professor')
      )
    );

CREATE POLICY "Utilizadores podem criar reservas para si mesmos" ON class_bookings
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Utilizadores podem apagar as suas reservas até X tempo" ON class_bookings
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Professores e Admin podem atualizar o estado (presença/falta)" ON class_bookings
    FOR UPDATE USING (
      EXISTS (
        SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Professor')
      )
    );
