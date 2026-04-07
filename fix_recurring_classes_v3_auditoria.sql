-- ==============================================================================
-- 🥋 FIX DEFINITIVO v3 — AULAS RECORRENTES + AUDITORIA COMPLETA
-- Data: 2026-04-07
-- ==============================================================================
-- ORDEM DE EXECUÇÃO:
--   PASSO 1 → PASSO 6 (em sequência no SQL Editor do Supabase)
-- ==============================================================================


-- ==============================================================================
-- PASSO 1: ADICIONAR COLUNA template_class_id À TABELA classes
-- Permite saber qual aula gerou esta (NULL = criada manualmente)
-- ==============================================================================
ALTER TABLE public.classes
ADD COLUMN IF NOT EXISTS template_class_id UUID
    REFERENCES public.classes(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.classes.template_class_id IS
    'ID da aula-mãe que gerou esta ocorrência via cron. NULL = criada manualmente.';


-- ==============================================================================
-- PASSO 2: CRIAR TABELA DE AUDITORIA class_audit_log
-- Regista TUDO o que acontece na tabela classes (quem criou, editou, apagou)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.class_audit_log (
    id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id        UUID        NOT NULL,
    action          TEXT        NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    performed_by    UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    performed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source          TEXT        NOT NULL DEFAULT 'manual'
                                CHECK (source IN ('manual', 'cron', 'system')),
    old_data        JSONB,
    new_data        JSONB,
    -- resumo legível para a interface
    summary         TEXT
);

-- Índices para pesquisa rápida
CREATE INDEX IF NOT EXISTS idx_audit_class_id   ON public.class_audit_log(class_id);
CREATE INDEX IF NOT EXISTS idx_audit_performed  ON public.class_audit_log(performed_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON public.class_audit_log(action);

-- RLS: Apenas Admin e Professores Responsáveis podem ver os logs
ALTER TABLE public.class_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_read_staff" ON public.class_audit_log;
CREATE POLICY "audit_log_read_staff" ON public.class_audit_log
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND role IN ('Admin', 'Professor Responsável', 'Professor')
        )
    );

COMMENT ON TABLE public.class_audit_log IS
    'Registo completo de auditoria de todas as operações na tabela classes.';


-- ==============================================================================
-- PASSO 3: CRIAR TRIGGER DE AUDITORIA
-- Dispara automaticamente em qualquer INSERT/UPDATE/DELETE na tabela classes
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.fn_class_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_action        TEXT;
    v_class_id      UUID;
    v_old_data      JSONB;
    v_new_data      JSONB;
    v_source        TEXT;
    v_performed_by  UUID;
    v_summary       TEXT;
BEGIN
    v_action       := TG_OP;
    v_performed_by := auth.uid(); -- NULL quando é o cron/sistema

    -- Determinar source
    IF v_performed_by IS NULL THEN
        v_source := 'cron';
    ELSE
        v_source := 'manual';
    END IF;

    IF TG_OP = 'DELETE' THEN
        v_class_id := OLD.id;
        v_old_data := to_jsonb(OLD);
        v_new_data := NULL;
        v_summary  := format('Aula "%s" de %s eliminada', OLD.title, OLD.date);
    ELSIF TG_OP = 'INSERT' THEN
        v_class_id := NEW.id;
        v_old_data := NULL;
        v_new_data := to_jsonb(NEW);
        IF NEW.template_class_id IS NOT NULL THEN
            v_source  := 'cron';
            v_summary := format('Aula recorrente "%s" gerada automaticamente para %s', NEW.title, NEW.date);
        ELSE
            v_summary := format('Nova aula "%s" criada para %s às %s', NEW.title, NEW.date, substr(NEW.start_time::text, 1, 5));
        END IF;
    ELSE -- UPDATE
        v_class_id := NEW.id;
        v_old_data := to_jsonb(OLD);
        v_new_data := to_jsonb(NEW);
        v_summary  := format('Aula "%s" de %s editada', NEW.title, NEW.date);
    END IF;

    INSERT INTO public.class_audit_log (
        class_id, action, performed_by, source, old_data, new_data, summary
    ) VALUES (
        v_class_id, v_action, v_performed_by, v_source, v_old_data, v_new_data, v_summary
    );

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$;

-- Remover trigger anterior se existir e recriar
DROP TRIGGER IF EXISTS tr_class_audit ON public.classes;
CREATE TRIGGER tr_class_audit
    AFTER INSERT OR UPDATE OR DELETE ON public.classes
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_class_audit();


-- ==============================================================================
-- PASSO 4: ATUALIZAR process_recurring_classes() — versão corrigida e completa
-- Melhorias:
--   ✅ Usa timezone Europe/Lisbon (sem bugs de fuso horário)
--   ✅ Preenche template_class_id (rastreio da origem)
--   ✅ Fallback de created_by: se NULL, usa professor_id
--   ✅ Chave de duplicado melhorada: (date, start_time, school_id)
--   ✅ Logs detalhados para auditoria
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.process_recurring_classes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_class       record;
    v_next_date   date;
    v_exists      boolean;
    v_today       date;
    v_yesterday   date;
    v_created_by  UUID;
BEGIN
    -- Sempre em hora de Portugal para evitar bugs de "dia errado"
    v_today     := (NOW() AT TIME ZONE 'Europe/Lisbon')::date;
    v_yesterday := v_today - 1;

    RAISE LOG '[process_recurring_classes] A correr. Hoje (Lisboa): %, Ontem: %', v_today, v_yesterday;

    FOR v_class IN
        SELECT * FROM public.classes
        WHERE is_recurring = true
          AND date = v_yesterday
    LOOP
        v_next_date := v_class.date + 7;

        -- Fallback: se created_by for NULL, usar professor_id
        v_created_by := COALESCE(v_class.created_by, v_class.professor_id);

        -- Verificar duplicado por (date, start_time, school_id)
        -- NÃO usamos o título — pode ser editado sem mudar o horário
        SELECT EXISTS (
            SELECT 1 FROM public.classes
            WHERE date       = v_next_date
              AND start_time = v_class.start_time
              AND (
                  (school_id = v_class.school_id)
                  OR (school_id IS NULL AND v_class.school_id IS NULL)
              )
        ) INTO v_exists;

        IF v_exists THEN
            RAISE LOG '[process_recurring_classes] ⚠️ Já existe aula para % às % (escola: %). A saltar.',
                v_next_date, v_class.start_time, v_class.school_id;
        ELSE
            INSERT INTO public.classes (
                title,
                date,
                start_time,
                end_time,
                capacity,
                professor_id,
                school_id,
                is_recurring,
                second_professor_id,
                created_by,
                template_class_id   -- ← rastreio da aula-mãe
            ) VALUES (
                v_class.title,
                v_next_date,
                v_class.start_time,
                v_class.end_time,
                v_class.capacity,
                v_class.professor_id,
                v_class.school_id,
                true,
                v_class.second_professor_id,
                v_created_by,
                v_class.id  -- ← ID da aula que gerou esta
            );

            RAISE LOG '[process_recurring_classes] ✅ Criada "%s" para % às %.',
                v_class.title, v_next_date, v_class.start_time;
        END IF;
    END LOOP;

    RAISE LOG '[process_recurring_classes] ✅ Concluído para ontem=%.', v_yesterday;
END;
$$;


-- ==============================================================================
-- PASSO 5: RECRIAR O CRON JOB (estava em falta desde ~2 de Abril!)
-- Remove qualquer vestígio anterior e cria UM único job.
-- ==============================================================================

-- Remover todos os jobs relacionados com aulas recorrentes (previne duplicados)
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE command ILIKE '%process_recurring_classes%'
   OR jobname ILIKE '%recurring%'
   OR jobname ILIKE '%recorr%';

-- Criar o único job oficial (01:00 UTC = 02:00 Lisboa — sempre depois da meia-noite)
SELECT cron.schedule(
    'daily_recurring_classes_process',
    '0 1 * * *',
    $$SELECT public.process_recurring_classes()$$
);

-- Confirmar que existe exatamente 1 job:
SELECT jobid, jobname, schedule, active
FROM cron.job
WHERE command ILIKE '%process_recurring_classes%';


-- ==============================================================================
-- PASSO 6: LIMPEZA — Duplicados + created_by NULL
-- ==============================================================================

-- 6a. Corrigir created_by = NULL (atribui o professor da aula)
UPDATE public.classes
SET created_by = professor_id
WHERE created_by IS NULL
  AND professor_id IS NOT NULL;

-- 6b. DIAGNÓSTICO — Ver duplicados antes de limpar (confirma o que vai ser apagado)
SELECT
    title,
    date,
    start_time,
    COALESCE(school_id::text, 'sem escola') AS escola,
    COUNT(*) AS total_duplicados,
    array_agg(id ORDER BY created_at) AS ids
FROM public.classes
GROUP BY title, date, start_time, school_id
HAVING COUNT(*) > 1
ORDER BY date DESC;

-- 6c. ELIMINAR DUPLICADOS (protege sempre aulas com inscrições)
DELETE FROM public.classes
WHERE id IN (
    SELECT id FROM (
        SELECT
            id,
            ROW_NUMBER() OVER (
                PARTITION BY date, start_time, COALESCE(school_id::text, 'NULL')
                ORDER BY
                    -- Prefere a aula com mais inscrições
                    (SELECT COUNT(*) FROM public.class_bookings cb WHERE cb.class_id = classes.id) DESC,
                    -- Em caso de empate, preserva a mais antiga (criada primeiro)
                    created_at ASC
            ) AS rn
        FROM public.classes
    ) ranked
    WHERE rn > 1
)
-- PROTEÇÃO ABSOLUTA: Nunca elimina aulas com inscrições
AND id NOT IN (
    SELECT DISTINCT class_id FROM public.class_bookings
);

-- 6d. Verificar resultado final — não deve haver duplicados
SELECT
    title, date, start_time,
    COALESCE(school_id::text, 'sem escola') AS escola,
    COUNT(*) AS total
FROM public.classes
GROUP BY title, date, start_time, school_id
HAVING COUNT(*) > 1;
-- Se não devolver linhas → ✅ sem duplicados


-- ==============================================================================
-- EXTRA: Query útil para monitorizar o audit log (para usar no futuro)
-- ==============================================================================
/*
SELECT
    l.performed_at,
    l.action,
    l.source,
    p.full_name AS feito_por,
    l.summary
FROM public.class_audit_log l
LEFT JOIN public.profiles p ON p.id = l.performed_by
ORDER BY l.performed_at DESC
LIMIT 50;
*/
