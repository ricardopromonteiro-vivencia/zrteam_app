-- ==============================================================================
-- AUTOMATIZAÇÃO DE AVISOS DE PAGAMENTO (Dia 5 de cada mês)
-- ==============================================================================
-- (Versão sem erro do pg_cron unschedule)
-- ==============================================================================

-- 1. Adicionar suporte a "Avisos Privados" na tabela de Announcements
ALTER TABLE public.announcements 
ADD COLUMN IF NOT EXISTS target_user_id UUID REFERENCES public.profiles(id) DEFAULT NULL;

-- Atualizar Políticas de Segurança para os utilizadores conseguirem ver os seus avisos pessoais
DROP POLICY IF EXISTS "Visualização de Avisos Respeitando Avisos Pessoais" ON public.announcements;
DROP POLICY IF EXISTS "Todos podem ver os avisos da sua escola ou globais" ON public.announcements;

CREATE POLICY "Visualização de Avisos Respeitando Avisos Pessoais" 
    ON public.announcements FOR SELECT 
    USING (
      (target_user_id IS NULL AND (
          school_id IS NULL OR 
          EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.school_id = announcements.school_id
          )
      ))
      OR 
      (target_user_id = auth.uid())
      OR 
      (EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('Admin', 'Professor')
      ))
    );

-- 2. Criar a Função Automática que cruza os dados e emite os avisos
CREATE OR REPLACE FUNCTION public.check_and_notify_pending_payments()
RETURNS void AS $$
DECLARE
    current_m integer := EXTRACT(MONTH FROM CURRENT_DATE);
    current_y integer := EXTRACT(YEAR FROM CURRENT_DATE);
    month_names text[] := ARRAY['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    v_target_user record;
    v_admin_id uuid;
BEGIN
    SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'Admin' AND is_archived = false LIMIT 1;
    IF v_admin_id IS NULL THEN RETURN; END IF;

    FOR v_target_user IN 
        SELECT p.id, p.full_name, p.school_id
        FROM public.profiles p
        WHERE p.role = 'Atleta' 
          AND (p.is_archived IS NULL OR p.is_archived = false)
          AND NOT EXISTS (
              SELECT 1 FROM public.payments pay 
              WHERE pay.athlete_id = p.id 
                AND pay.month = current_m 
                AND pay.year = current_y 
                AND pay.status = 'Pago'
          )
    LOOP
        INSERT INTO public.announcements (
            title, 
            content, 
            type, 
            author_id, 
            school_id, 
            target_user_id
        ) VALUES (
            'Lembrete de Pagamento (' || month_names[current_m] || ')',
            'Olá ' || split_part(v_target_user.full_name, ' ', 1) || ', verificámos que a tua mensalidade relativa a ' || month_names[current_m] || ' ainda não se encontra regularizada. Por favor, regulariza o pagamento até ao dia 8 para evitar multas de atraso. Se já efetuaste o pagamento, por favor ignora este aviso.',
            'system',
            v_admin_id,
            v_target_user.school_id,
            v_target_user.id
        );
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. AGENDAMENTO COM PG_CRON
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

-- Cria (ou sobrescreve se já existir do erro anterior) a tarefa de agendamento 
SELECT cron.schedule(
    'monthly_payment_reminder', 
    '0 8 5 * *', 
    $$SELECT public.check_and_notify_pending_payments()$$
);
