-- Adicionar coluna para desativar gestão de pagamentos por escola
ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS payment_management_enabled BOOLEAN DEFAULT true;

-- Atualizar o comentário da tabela para documentar a nova coluna
COMMENT ON COLUMN public.schools.payment_management_enabled IS 'Indica se a escola utiliza o sistema de gestão de pagamentos da plataforma.';

-- Atualizar a função de notificação de pagamentos pendentes para respeitar esta configuração
CREATE OR REPLACE FUNCTION public.check_and_notify_pending_payments()
RETURNS void AS $$
DECLARE
  current_m integer := EXTRACT(MONTH FROM CURRENT_DATE);
  current_y integer := EXTRACT(YEAR FROM CURRENT_DATE);
  month_names text[] := ARRAY['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                               'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  v_user record; v_admin_id uuid;
BEGIN
  -- Obter um administrador para ser o autor dos avisos de sistema
  SELECT id INTO v_admin_id FROM public.profiles WHERE role = 'Admin' AND is_archived = false LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN; END IF;

  FOR v_user IN
    SELECT p.id, p.full_name, p.school_id 
    FROM public.profiles p
    JOIN public.schools s ON p.school_id = s.id
    WHERE p.role = 'Atleta' 
      AND p.is_archived = false
      AND s.payment_management_enabled = true  -- APENAS ESCOLAS COM GESTÃO ATIVA
      AND NOT EXISTS (
        SELECT 1 FROM public.payments pay
        WHERE pay.athlete_id = p.id 
          AND pay.month = current_m 
          AND pay.year = current_y 
          AND pay.status = 'Pago'
      )
  LOOP
    INSERT INTO public.announcements (title, content, type, author_id, school_id, target_user_id)
    VALUES (
      'Lembrete de Pagamento (' || month_names[current_m] || ')',
      'Olá ' || split_part(v_user.full_name, ' ', 1) || ', a mensalidade de ' || month_names[current_m] || ' ainda não foi regularizada.',
      'system', v_admin_id, v_user.school_id, v_user.id
    );
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
