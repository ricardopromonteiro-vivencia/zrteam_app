-- ==============================================================================
-- 🥋 ZR TEAM APP — Adicionar created_by à tabela classes + View legível
-- ==============================================================================

-- 1. Adicionar coluna created_by à tabela classes
--    (referência ao profile de quem criou a aula)
ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id);

-- 2. Criar (ou substituir) uma view para leitura fácil no Supabase
--    Mostra: nome da escola, nome do professor e nome de quem criou
CREATE OR REPLACE VIEW public.classes_view AS
SELECT
  c.id,
  c.title,
  c.date,
  c.start_time,
  c.end_time,
  c.capacity,
  c.is_recurring,
  c.created_at,
  s.name                         AS school_name,
  prof.full_name                 AS professor_name,
  prof2.full_name                AS second_professor_name,
  creator.full_name              AS created_by_name
FROM public.classes c
LEFT JOIN public.schools       s      ON s.id      = c.school_id
LEFT JOIN public.profiles      prof   ON prof.id   = c.professor_id
LEFT JOIN public.profiles      prof2  ON prof2.id  = c.second_professor_id
LEFT JOIN public.profiles      creator ON creator.id = c.created_by
ORDER BY c.date DESC, c.start_time ASC;

-- ==============================================================================
-- NOTA: A coluna created_by foi adicionada como nullable (sem NOT NULL),
-- pois as aulas já existentes não têm este dado. Novas aulas criadas
-- precisarão de enviar o created_by no INSERT (ver passo no frontend abaixo).
-- ==============================================================================
