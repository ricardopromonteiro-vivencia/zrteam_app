import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

// Chave pública hardcoded para evitar problemas de cache do Vite/Netlify
const VAPID_PUBLIC_KEY = 'BG3O58-eBUmO8wdbraYOq1cJFlCz0xwfmtmnTSTtqpLgysssBGPm5vvPU0fzHVVuqmiG1ijGJP2uX6KrzIWOahb8';

function urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

export function usePushNotifications(userId: string | undefined) {
    const [permission, setPermission] = useState<NotificationPermission>(() =>
        typeof Notification !== 'undefined' ? Notification.permission : 'denied'
    );
    const [isSubscribed, setIsSubscribed] = useState(false);

    // Verificar se ja esta subscrito ao carregar
    useEffect(() => {
        if (!userId || !('serviceWorker' in navigator)) return;
        navigator.serviceWorker.ready.then(async (reg) => {
            const sub = await reg.pushManager.getSubscription();
            setIsSubscribed(!!sub);
        });
    }, [userId]);

    async function subscribe() {
        if (!userId || !VAPID_PUBLIC_KEY) return;

        // Pedir permissão se ainda não foi concedida
        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== 'granted') return;

        try {
            const reg = await navigator.serviceWorker.ready;

            // FORÇAR LIMPEZA DA SUBSCRIÇÃO ANTIGA
            // O erro 'InvalidAccessError' acontece quase sempre quando já
            // existe uma subscrição com uma VAPID key diferente e tentamos re-subscrever
            const existingSub = await reg.pushManager.getSubscription();
            if (existingSub) {
                await existingSub.unsubscribe();
            }

            const sub = await reg.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            const subJson = sub.toJSON();
            const keys = subJson.keys as { p256dh: string; auth: string };

            // Guardar a subscrição na base de dados
            await supabase.from('push_subscriptions').upsert({
                user_id: userId,
                endpoint: sub.endpoint,
                p256dh: keys.p256dh,
                auth: keys.auth,
            }, { onConflict: 'endpoint' });

            setIsSubscribed(true);
        } catch (err) {
            console.error('Erro ao subscrever push notifications:', err);
        }
    }

    async function unsubscribe() {
        if (!userId) return;
        try {
            const reg = await navigator.serviceWorker.ready;
            const sub = await reg.pushManager.getSubscription();
            if (sub) {
                await sub.unsubscribe();
                await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
            }
            setIsSubscribed(false);
        } catch (err) {
            console.error('Erro ao cancelar push notifications:', err);
        }
    }

    const isSupported = typeof Notification !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

    return { permission, isSubscribed, isSupported, subscribe, unsubscribe };
}
