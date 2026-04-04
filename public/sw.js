// Service Worker com auto-update para evitar erros de cache em novos deploys
// ⚠️ Incrementa este número a cada deploy para forçar a atualização nos clientes
const CACHE_NAME = 'zrteam-v3';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/manifest.json'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Força o novo SW a assumir o controlo imediatamente
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            self.clients.claim(),
            // Limpar caches antigos
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.filter(name => name !== CACHE_NAME).map(name => caches.delete(name))
                );
            })
        ])
    );
});

self.addEventListener('fetch', (event) => {
    // Estratégia Network-First para evitar o erro de MIME type em ficheiros JS que mudam de hash
    // Se o ficheiro JS não existe no servidor (404), queremos que o erro apareça em vez de receber o index.html
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request))
    );
});

// ============================================================
// PUSH NOTIFICATIONS
// ============================================================

// Recebe a notificação push do servidor (Supabase Edge Function)
self.addEventListener('push', (event) => {
    let data = { title: 'ZR Team', body: 'Tens uma nova notificação.', url: '/' };

    if (event.data) {
        try {
            data = { ...data, ...event.data.json() };
        } catch (_) {
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-192x192.png',
            data: { url: data.url },
            vibrate: [200, 100, 200],
        })
    );
});

// Ao clicar na notificação, abre ou foca a aba correspondente
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const targetUrl = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            // Se a app já está aberta, foca-a
            for (const client of clientList) {
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    client.navigate(targetUrl);
                    return client.focus();
                }
            }
            // Senão, abre uma nova janela
            if (clients.openWindow) {
                return clients.openWindow(targetUrl);
            }
        })
    );
});
