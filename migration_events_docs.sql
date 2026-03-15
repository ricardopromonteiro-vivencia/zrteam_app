-- ==============================================================================
-- 🥋 ZR TEAM APP — MIGRAÇÃO DE EVENTOS E DOCUMENTOS (COM INSCRIÇÕES E PAGAMENTOS)
-- ==============================================================================

-- 1. TABELA DE EVENTOS
CREATE TABLE IF NOT EXISTS public.events (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text NOT NULL,
    location text NOT NULL,
    school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE, -- null significa todas as escolas
    capacity integer NOT NULL DEFAULT 0, -- 0 significa sem limite
    registration_deadline timestamp with time zone NOT NULL,
    dates jsonb NOT NULL DEFAULT '[]', -- array de datas ['2023-10-01', '2023-10-02']
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users based on school" ON public.events
    FOR SELECT USING (
        school_id IS NULL OR 
        school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin'
    );

CREATE POLICY "Enable insert for Admins and Head Professors" ON public.events
    FOR INSERT WITH CHECK (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor Responsável')
    );

CREATE POLICY "Enable update for Admins and Head Professors" ON public.events
    FOR UPDATE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor Responsável')
    );

CREATE POLICY "Enable delete for Admins and Head Professors" ON public.events
    FOR DELETE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor Responsável')
    );


-- 2. TABELA DE INSCRIÇÕES EM EVENTOS
CREATE TABLE IF NOT EXISTS public.event_registrations (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id uuid REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    payment_status text NOT NULL DEFAULT 'Pendente'::text CHECK (payment_status IN ('Pendente', 'Pago', 'Isento')),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(event_id, user_id)
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for all" ON public.event_registrations
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for authenticated users" ON public.event_registrations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Enable update for Admins and Head Professors" ON public.event_registrations
    FOR UPDATE USING (
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor Responsável')
    );

CREATE POLICY "Enable delete for authenticated users" ON public.event_registrations
    FOR DELETE USING (
        auth.uid() = user_id OR 
        (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('Admin', 'Professor Responsável')
    );


-- 3. TABELA DE DOCUMENTOS
CREATE TABLE IF NOT EXISTS public.documents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    link_url text NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all users" ON public.documents
    FOR SELECT USING (true);

CREATE POLICY "Enable insert for Admins only" ON public.documents
    FOR INSERT WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Enable update for Admins only" ON public.documents
    FOR UPDATE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');

CREATE POLICY "Enable delete for Admins only" ON public.documents
    FOR DELETE USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'Admin');
