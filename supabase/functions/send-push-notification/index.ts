// Supabase Edge Function: send-push-notification
// Deploy: supabase functions deploy send-push-notification
// Secrets necessários no Supabase Dashboard > Edge Functions > Secrets:
//   VAPID_PRIVATE_KEY=<private key gerada pelo web-push>
//   VAPID_PUBLIC_KEY=<public key gerada pelo web-push>
//   VAPID_SUBJECT=mailto:zrteamcheck@gmail.com

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL')!,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
        );

        const body = await req.json();
        const { target, title, body: msgBody, url } = body;

        console.log('[push] target:', JSON.stringify(target), '| title:', title);

        // Buscar as subscrições alvo
        let subscriptions: any[] = [];

        if (target === 'all') {
            // Notificar todos os utilizadores com subscrição activa
            const { data, error } = await supabase
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth, user_id');
            if (error) console.error('[push] Erro ao buscar subs (all):', error.message);
            subscriptions = data || [];
        } else if (target === 'admins') {
            // Notificar admins e professores
            const { data: adminIds } = await supabase
                .from('profiles')
                .select('id')
                .in('role', ['Admin', 'Professor', 'Professor Responsável']);
            const ids = (adminIds || []).map((p: any) => p.id);
            console.log('[push] admins/profs ids:', ids.length);
            if (ids.length > 0) {
                const { data, error } = await supabase
                    .from('push_subscriptions')
                    .select('endpoint, p256dh, auth, user_id')
                    .in('user_id', ids);
                if (error) console.error('[push] Erro ao buscar subs (admins):', error.message);
                subscriptions = data || [];
            }
        } else if (target?.user_id) {
            // Notificar utilizador específico
            const { data, error } = await supabase
                .from('push_subscriptions')
                .select('endpoint, p256dh, auth, user_id')
                .eq('user_id', target.user_id);
            if (error) console.error('[push] Erro ao buscar subs (user_id):', error.message);
            subscriptions = data || [];
        } else if (target?.school_id) {
            // Notificar TODOS os utilizadores dessa escola (atletas + profesores + admin)
            const { data: members } = await supabase
                .from('profiles')
                .select('id')
                .eq('school_id', target.school_id);
            const ids = (members || []).map((p: any) => p.id);
            console.log('[push] membros da escola:', ids.length);
            if (ids.length > 0) {
                const { data, error } = await supabase
                    .from('push_subscriptions')
                    .select('endpoint, p256dh, auth, user_id')
                    .in('user_id', ids);
                if (error) console.error('[push] Erro ao buscar subs (school_id):', error.message);
                subscriptions = data || [];
            }
        }

        console.log('[push] subscrições encontradas:', subscriptions.length);

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ sent: 0, reason: 'no subscriptions found for target' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
        const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
        const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:zrteamcheck@gmail.com';

        if (!VAPID_PRIVATE_KEY || !VAPID_PUBLIC_KEY) {
            console.error('[push] VAPID keys em falta!');
            return new Response(JSON.stringify({ error: 'VAPID keys not configured' }), {
                status: 500,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const payload = JSON.stringify({ title, body: msgBody, url: url || '/' });
        console.log('[push] payload:', payload);

        // Importar web-push compatível com Deno
        const { default: webpush } = await import('npm:web-push');
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        let sent = 0;
        const failed: string[] = [];
        const errors: string[] = [];

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                sent++;
                console.log('[push] ✅ enviado para:', sub.endpoint.substring(0, 60));
            } catch (err: any) {
                console.error('[push] ❌ falhou para:', sub.endpoint.substring(0, 60), '| erro:', err.statusCode, err.message);
                errors.push(`${err.statusCode}: ${err.message}`);
                // Endpoint expirado (410 Gone) / 404 — remover da base de dados
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabase
                        .from('push_subscriptions')
                        .delete()
                        .eq('endpoint', sub.endpoint);
                    console.log('[push] subscrição expirada removida');
                }
                failed.push(sub.endpoint);
            }
        }

        console.log(`[push] resultado: ${sent} enviados, ${failed.length} falharam`);

        return new Response(JSON.stringify({ sent, failed: failed.length, errors }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('[push] Erro geral:', err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
