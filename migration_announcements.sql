-- Criação da tabela de Avisos/Notícias
CREATE TABLE IF NOT EXISTS public.announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now(),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    type TEXT DEFAULT 'general' CHECK (type IN ('general', 'class_update', 'system')),
    is_sent_to_all BOOLEAN DEFAULT FALSE
);

-- Ativar RLS
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Política de Leitura: Atletas, Professores e Admins veem avisos da sua escola ou globais
CREATE POLICY "Utilizadores veem avisos da sua escola ou globais" 
ON public.announcements FOR SELECT 
TO authenticated 
USING (
    school_id IS NULL OR 
    school_id = (SELECT school_id FROM public.profiles WHERE id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')
);

-- Política de Escrita: Apenas Admins e Professores podem criar avisos
-- Professores apenas para a sua escola
CREATE POLICY "Admins e Professores criam avisos" 
ON public.announcements FOR INSERT 
TO authenticated 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND (role = 'Admin' OR role = 'Professor')
    )
);

-- Política de Eliminação: Apenas o autor ou Admins
CREATE POLICY "Autores ou Admins emitem delete" 
ON public.announcements FOR DELETE 
TO authenticated 
USING (
    author_id = auth.uid() OR 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'Admin')
);

-- Comentários da tabela
COMMENT ON TABLE public.announcements IS 'Tabela que armazena avisos e notícias para os atletas.';
