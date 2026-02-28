import { useEffect, useState } from 'react';
import { Mail, Smartphone, Info, MapPin, Clock, Download } from 'lucide-react';

export default function Help() {
  const currentYear = new Date().getFullYear();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="help-container animate-fade-in">
      <header className="page-header">
        <h1 className="page-title">Ajuda & Suporte</h1>
        <p className="page-subtitle">Tudo o que precisas de saber sobre a aplicação ZR Team.</p>
      </header>

      <div className="help-grid">
        {/* Contacto de Suporte */}
        <section className="help-card support-card">
          <div className="card-icon"><Mail size={32} /></div>
          <h2>Apoio ao Utilizador</h2>
          <p>Tens alguma dúvida ou encontraste um problema? Envia-nos um email:</p>
          <a href="mailto:zrteamcheck@gmail.com" className="support-email">zrteamcheck@gmail.com</a>
        </section>

        {/* Instalação Inteligente */}
        {!isInstalled && (
          <section className="help-card install-card animate-pulse-subtle">
            <div className="card-icon"><Download size={32} /></div>
            <h2>Instalar Aplicação</h2>
            <p>Instala a app no teu telemóvel para um acesso mais rápido e notificações.</p>
            {deferredPrompt ? (
              <button onClick={handleInstallClick} className="btn-install-pwa">
                Instalar Agora
              </button>
            ) : (
              <div className="install-notice">
                <p>Já podes instalar através do menu do teu navegador (Chrome/Safari).</p>
                <p className="install-hint">Vê as instruções abaixo para o teu dispositivo.</p>
              </div>
            )}
          </section>
        )}

        {/* Guia de Instalação PWA */}
        <section className="help-card">
          <div className="card-icon"><Smartphone size={32} /></div>
          <h2>Como Instalar no Telemóvel</h2>
          <div className="guide-content">
            <h3>Android (Chrome)</h3>
            <ol>
              <li>Abre o Chrome e acede ao site.</li>
              <li>Clica nos 3 pontos verticais no topo direito.</li>
              <li>Seleciona <strong>"Instalar aplicação"</strong> ou <strong>"Adicionar ao ecrã principal"</strong>.</li>
            </ol>

            <h3>iPhone/iOS (Safari)</h3>
            <ol>
              <li>Abre o Safari e acede ao site.</li>
              <li>Clica no botão de <strong>Partilha</strong> (ícone com seta para cima).</li>
              <li>Desliza para baixo e clica em <strong>"Adicionar ao Ecrã Principal"</strong>.</li>
            </ol>
          </div>
        </section>

        {/* Guia de Check-in */}
        <section className="help-card">
          <div className="card-icon"><Info size={32} /></div>
          <h2>Dicas de Utilização</h2>
          <div className="guide-content">
            <h3>Check-in Seguro</h3>
            <p>Para fazer check-in com sucesso:</p>
            <ul className="tips-list">
              <li>
                <MapPin size={16} className="tip-icon" />
                <span>Deves estar dentro das instalações da escola, a aplicação usa a tua localização.</span>
              </li>
              <li>
                <Clock size={16} className="tip-icon" />
                <span>Podes fazer check-in 30 min antes ou até 30 min depois da aula terminar.</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <footer className="help-footer">
        <p>&copy; {currentYear} ZR Team. Todos os direitos reservados.</p>
        <p>Desenvolvido por <strong>Monteirismo</strong></p>
      </footer>

      <style>{`
        .help-container {
          max-width: 1200px;
          margin: 0 auto;
        }
        .page-header {
          margin-bottom: 2rem;
          text-align: left;
        }
        .help-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .help-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1rem;
          padding: 2rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .card-icon {
          color: var(--primary);
          margin-bottom: 0.5rem;
        }
        .support-card {
          text-align: center;
          align-items: center;
        }
        .support-email {
          color: var(--primary);
          font-weight: 700;
          font-size: 1.125rem;
          text-decoration: none;
          padding: 0.5rem 1rem;
          background: rgba(16, 185, 129, 0.1);
          border-radius: 0.5rem;
          transition: transform 0.2s;
        }
        .support-email:hover {
          transform: scale(1.05);
        }
        .install-card {
          border: 2px solid var(--primary);
          background: rgba(16, 185, 129, 0.05);
          text-align: center;
          align-items: center;
        }
        .btn-install-pwa {
          background: var(--primary);
          color: white;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          width: 100%;
          transition: transform 0.2s, background 0.2s;
        }
        .btn-install-pwa:hover {
          background: #059669;
          transform: translateY(-2px);
        }
        .install-notice {
          font-size: 0.8rem;
          color: var(--text-muted);
        }
        .install-hint {
          margin-top: 0.5rem;
          color: var(--primary);
          font-weight: 600;
        }
        .animate-pulse-subtle {
            animation: pulse-bg 3s infinite;
        }
        @keyframes pulse-bg {
            0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.2); }
            70% { box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
            100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .guide-content h3 {
          font-size: 1rem;
          margin: 1.5rem 0 0.5rem;
          color: var(--primary);
        }
        .guide-content ol, .guide-content ul {
          padding-left: 1rem;
          margin-bottom: 1rem;
        }
        .tips-list {
          list-style: none;
          padding: 0 !important;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          margin-top: 1rem;
        }
        .tips-list li {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          font-size: 0.875rem;
          color: var(--text-muted);
          line-height: 1.4;
        }
        .tip-icon {
          color: var(--primary);
          margin-top: 0.2rem;
          flex-shrink: 0;
        }
        .guide-content li {
          margin-bottom: 0.5rem;
          font-size: 0.875rem;
          color: var(--text-muted);
        }
        .help-footer {
          margin-top: 4rem;
          padding: 2rem 0;
          border-top: 1px solid var(--border);
          text-align: center;
          color: var(--text-muted);
          font-size: 0.8rem;
        }
        .help-footer p {
          margin-bottom: 0.25rem;
        }
        .help-footer strong {
          color: var(--primary);
        }
      `}</style>
    </div>
  );
}
