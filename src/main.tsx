import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import App from './App.tsx'

// ── Splash Screen: esconde quando o App estiver pronto E mín. 2s passaram ───
const SPLASH_MIN_MS = 2000;
const splashStart = Date.now();

function hideSplash() {
  const splash = document.getElementById('zr-splash');
  if (!splash || splash.classList.contains('hidden')) return;
  splash.classList.add('hidden');
  setTimeout(() => splash.remove(), 600);
}

// Garante tempo mínimo + espera sinal do App
let appReady = false;
let minTimeReached = false;

function tryHide() {
  if (appReady && minTimeReached) hideSplash();
}

// Timer mínimo: 2 segundos
const elapsed = Date.now() - splashStart;
const remaining = Math.max(0, SPLASH_MIN_MS - elapsed);
setTimeout(() => { minTimeReached = true; tryHide(); }, remaining);

// Evento 'zr:appready' disparado pelo App.tsx quando a sessão está carregada
window.addEventListener('zr:appready', () => { appReady = true; tryHide(); }, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// ── Service Worker: registo + auto-refresh em novo deploy ────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('SW registado com sucesso!', reg);

      // Verificar atualizações imediatamente ao registar
      reg.update();

      // Quando um novo SW toma controlo (novo deploy detectado) → recarregar
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('Novo SW ativo → a recarregar para atualizar...');
        window.location.reload();
      });
    }).catch(err => console.log('Erro ao registar SW:', err));
  });
}
