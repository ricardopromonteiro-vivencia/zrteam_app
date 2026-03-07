// Supabase Edge Function: send-push-notification
// Deploy: supabase functions deploy send-push-notification
// Secrets necessários no Supabase Dashboard > Edge Functions > Secrets:
//   VAPID_PRIVATE_KEY=<private key gerada pelo web-push>
//   VAPID_PUBLIC_KEY=<public key gerada pelo web-push>
//   VAPID_SUBJECT=mailto:zrteamcheck@gmail.com

import { createClient } from 'jsr:@supabase/supabase-js@2';

// Deno não tem webpush nativo, usamos a biblioteca web-push via esm.sh com compatibilidade
// alternativa que funciona em Deno: implementamos a chamada VAPID manualmente via Web Crypto API.

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

        const { target, title, body, url } = await req.json();
        // target: 'all' | 'admins' | { user_id: string } | { school_id: string, role: 'Professor' }

        // Buscar as subscrições alvo
        let query = supabase.from('push_subscriptions').select('endpoint, p256dh, auth, user_id');

        if (target === 'admins') {
            // Só admins e professores responsáveis
            const { data: adminIds } = await supabase
                .from('profiles')
                .select('id')
                .in('role', ['Admin', 'Professor']);
            const ids = (adminIds || []).map((p: any) => p.id);
            query = query.in('user_id', ids);
        } else if (target?.user_id) {
            query = query.eq('user_id', target.user_id);
        } else if (target?.school_id) {
            // Professores de uma escola específica
            const { data: profIds } = await supabase
                .from('profiles')
                .select('id')
                .eq('school_id', target.school_id)
                .eq('role', 'Professor');
            const ids = (profIds || []).map((p: any) => p.id);
            query = query.in('user_id', ids);
        }
        // Se target === 'all', não filtra

        const { data: subscriptions } = await query;

        if (!subscriptions || subscriptions.length === 0) {
            return new Response(JSON.stringify({ sent: 0 }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }

        const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!;
        const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!;
        const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:zrteamcheck@gmail.com';

        const payload = JSON.stringify({ title, body, url: url || '/' });

        // Importar assinatura VAPID via web-push compatível com Deno
        const { default: webpush } = await import('npm:web-push');
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

        let sent = 0;
        const failed: string[] = [];

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification(
                    { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
                    payload
                );
                sent++;
            } catch (err: any) {
                // Endpoint expirado (410 Gone) — remover da base de dados
                if (err.statusCode === 410 || err.statusCode === 404) {
                    await supabase
                        .from('push_subscriptions')
                        .delete()
                        .eq('endpoint', sub.endpoint);
                }
                failed.push(sub.endpoint);
            }
        }

        return new Response(JSON.stringify({ sent, failed: failed.length }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
    }
});
