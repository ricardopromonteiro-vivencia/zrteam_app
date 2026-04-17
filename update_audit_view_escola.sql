-- Apagar a VIEW existente primeiro (necessário para alterar colunas)
DROP VIEW IF EXISTS public.v_class_audit;

-- Recriar a VIEW de auditoria com o nome da escola
CREATE OR REPLACE VIEW public.v_class_audit AS
SELECT
    l.id,
    l.performed_at,
    l.action,
    CASE l.action
        WHEN 'INSERT' THEN '➕ Criada'
        WHEN 'UPDATE' THEN '✏️ Editada'
        WHEN 'DELETE' THEN '🗑️ Eliminada'
    END                               AS acao_label,
    l.source,
    CASE l.source
        WHEN 'cron'   THEN '🤖 Sistema automático'
        WHEN 'manual' THEN '👤 ' || COALESCE(p.full_name, 'Desconhecido')
        ELSE COALESCE(p.full_name, 'Sistema')
    END                               AS feito_por,
    COALESCE(
        l.new_data->>'title',
        l.old_data->>'title'
    )                                 AS titulo,
    COALESCE(
        l.new_data->>'date',
        l.old_data->>'date'
    )                                 AS data_aula,
    COALESCE(
        l.new_data->>'start_time',
        l.old_data->>'start_time'
    )                                 AS hora,
    -- Nome da escola (obtido via JOIN usando o school_id guardado no JSONB)
    s.name                            AS escola,
    l.summary
FROM public.class_audit_log l
LEFT JOIN public.profiles p ON p.id = l.performed_by
LEFT JOIN public.schools s
       ON s.id = (
           COALESCE(
               l.new_data->>'school_id',
               l.old_data->>'school_id'
           )
       )::uuid
ORDER BY l.performed_at DESC;
