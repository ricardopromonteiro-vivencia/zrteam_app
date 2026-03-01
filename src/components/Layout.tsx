import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  LogOut, Home, Calendar, Users, Activity, Settings,
  ShieldCheck, Menu, X, Building2, HelpCircle, Download, CreditCard
} from 'lucide-react';
import logo from '../assets/logo.png';

export default function Layout() {
  const [profile, setProfile] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
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

  useEffect(() => {
    // Fechar a sidebar quando a rota muda (útil em mobile)
    setIsSidebarOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }

      let { data, error } = await supabase
        .from('profiles')
        .select('*, school:schools(name), assigned_professor:profiles!assigned_professor_id(full_name)')
        .eq('id', session.user.id)
        .single();

      // Se o perfil não existe (trigger falhou no registo), cria-o agora
      if (error && error.code === 'PGRST116') {
        const meta = session.user.user_metadata;
        const { data: created, error: createError } = await supabase
          .from('profiles')
          .insert({
            id: session.user.id,
            full_name: meta?.full_name || session.user.email || 'Utilizador',
            role: meta?.role || 'Atleta',
          })
          .select()
          .single();

        if (created) {
          data = created;
          error = null;
        } else {
          console.error('Erro ao criar perfil:', createError);
        }
      }

      if (data) {
        setProfile(data);
      } else if (error) {
        console.error('Erro ao carregar perfil:', error);
        // Logout para o utilizador tentar novamente
        await supabase.auth.signOut();
        navigate('/');
      }
    }
    loadSession();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const navItems = profile?.role === 'Atleta'
    ? [
      { name: 'Dashboard', path: '/dashboard', icon: Home },
      { name: 'Aulas', path: '/aulas', icon: Calendar },
      { name: 'Área Pessoal', path: '/settings', icon: Settings },
    ]
    : [
      { name: 'Dashboard', path: '/dashboard', icon: Activity },
      { name: 'Gestão de Aulas', path: '/admin/aulas', icon: Calendar },
      { name: 'Atletas', path: '/admin/atletas', icon: Users },
      { name: 'Gestão de Escolas', path: '/admin/escolas', icon: Building2 },
      { name: 'Check-in', path: '/admin/checkin', icon: Activity },
      { name: 'Definições', path: '/settings', icon: Settings },
    ];

  if (!profile) return <div className="loading-state">A carregar perfil...</div>;

  return (
    <div className="layout-container">
      {/* Botão Hamburger (Apenas Mobile) */}
      <header className="mobile-header">
        <button className="hamburger-btn" onClick={() => setIsSidebarOpen(true)}>
          <Menu size={24} />
        </button>
        <img src={logo} alt="ZR Team" className="mobile-header-logo" />
      </header>

      {/* Overlay (Apenas Mobile) */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)} />
      )}

      <nav className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <img src={logo} alt="ZR Team" className="sidebar-logo" />
            <button className="close-sidebar-btn" onClick={() => setIsSidebarOpen(false)}>
              <X size={24} />
            </button>
          </div>
          <span className="role-badge">{profile.role}</span>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          ))}
          {(profile?.role === 'Admin' || profile?.role === 'Professor') && (
            <Link
              to="/admin/pagamentos"
              className={`nav-link ${location.pathname === '/admin/pagamentos' ? 'active' : ''}`}
              onClick={() => setIsSidebarOpen(false)}
            >
              <CreditCard size={20} />
              Pagamentos
            </Link>
          )}
          <Link to="/termos" className="nav-link terms-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <ShieldCheck size={20} /> Termos e Condições
          </Link>
          <Link to="/ajuda" className={`nav-link help-nav-link ${location.pathname === '/ajuda' ? 'active' : ''}`} onClick={() => setIsSidebarOpen(false)}>
            <HelpCircle size={20} /> Ajuda & Suporte
          </Link>
          {deferredPrompt && (
            <button onClick={handleInstallClick} className="nav-link install-nav-btn">
              <Download size={20} /> Instalar App
            </button>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="user-info">
            <span className="user-name">{profile.full_name}</span>
            <span className="user-belt">{profile.belt}</span>
          </div>
          <button onClick={handleSignOut} className="btn-logout" title="Sair">
            <LogOut size={20} />
          </button>
        </div>
        <div className="zr-credits">
          <p>© {new Date().getFullYear()} Todos os direitos reservados</p>
          <p>Desenvolvido por <strong>Monteirismo</strong></p>
        </div>
      </nav>

      <main className="main-content">
        <Outlet context={{ profile }} />
      </main>

      {/* Estilos específicos do Layout que podem ser partilhados */}
      <style>{`
        .layout-container {
          display: flex;
          min-height: 100vh;
        }
        
        /* Mobile Header */
        .mobile-header {
          display: none;
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 60px;
          background-color: var(--bg-card);
          border-bottom: 1px solid var(--border);
          padding: 0 1rem;
          align-items: center;
          justify-content: space-between;
          z-index: 50;
        }
        .hamburger-btn {
          color: var(--text-main);
          background: none;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
        }
        .mobile-header-logo {
          height: 40px;
        }

        .sidebar {
          width: 250px;
          background-color: var(--bg-card);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          z-index: 100;
          transition: transform 0.3s ease;
        }
        .sidebar-header-top {
          display: flex;
          width: 100%;
          justify-content: center;
          align-items: center;
          position: relative;
        }
        .close-sidebar-btn {
          display: none;
          position: absolute;
          right: 0;
          top: 0;
          color: var(--text-muted);
          background: none;
          border: none;
          padding: 0.5rem;
          cursor: pointer;
        }
        
        .sidebar-header {
          padding: 1.5rem;
          border-bottom: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
        }
        .sidebar-logo {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 2px solid var(--primary);
          padding: 2px;
          background: white;
        }
        .sidebar-header h2 {
          color: var(--primary);
          margin-bottom: 0.5rem;
        }
        .role-badge {
          background-color: rgba(16, 185, 129, 0.1);
          color: var(--primary);
          padding: 0.25rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          text-transform: uppercase;
        }
        .sidebar-nav {
          padding: 1rem 0;
          flex: 1;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.5rem;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .nav-link:hover, .nav-link.active {
          background-color: rgba(255, 255, 255, 0.05);
          color: var(--primary);
          border-right: 3px solid var(--primary);
          text-decoration: none;
        }
        .install-nav-btn {
          width: 100%;
          background: none;
          border: none;
          cursor: pointer;
          font-family: inherit;
          font-size: inherit;
          color: var(--primary) !important;
          font-weight: 700;
          margin-top: 0.5rem;
          background: rgba(16, 185, 129, 0.05) !important;
        }
        .install-nav-btn:hover {
          background: rgba(16, 185, 129, 0.1) !important;
        }
        .sidebar-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .zr-credits {
          padding: 1rem 1.5rem;
          font-size: 0.65rem;
          color: var(--text-muted);
          text-align: center;
          border-top: 1px solid rgba(255,255,255,0.02);
          line-height: 1.4;
        }
        .zr-credits strong {
          color: var(--primary);
        }
        .user-info {
          display: flex;
          flex-direction: column;
        }
        .user-name {
          font-weight: 600;
          font-size: 0.875rem;
        }
        .user-belt {
          color: var(--text-muted);
          font-size: 0.75rem;
        }
        .btn-logout {
          color: var(--text-muted);
          background: none;
          border: none;
          cursor: pointer;
        }
        .btn-logout:hover {
          color: var(--danger);
        }
        .main-content {
          flex: 1;
          padding: 2rem;
          overflow-y: auto;
          background-color: var(--bg-dark);
        }
        .loading-state {
          display: flex;
          min-height: 100vh;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
        }

        /* Mobile Adjustments */
        @media (max-width: 768px) {
          .mobile-header {
            display: flex;
          }
          .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: 280px;
            transform: translateX(-100%);
            box-shadow: 10px 0 20px rgba(0,0,0,0.5);
          }
          .sidebar.open {
            transform: translateX(0);
          }
          .sidebar-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(2px);
            z-index: 90;
          }
          .close-sidebar-btn {
            display: block;
          }
          .main-content {
            padding: 1rem;
            margin-top: 60px; /* Espaço para a barra fixa de topo em mobile */
          }
          .sidebar-header {
            padding-top: 2rem;
          }
        }
      `}</style>
    </div>
  );
}
