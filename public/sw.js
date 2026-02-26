// Service Worker com auto-update para evitar erros de cache em novos deploys
const CACHE_NAME = 'zrteam-v2';
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
