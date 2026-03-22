import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  LogOut, Home, Calendar, Users, Activity, Settings,
  ShieldCheck, Menu, X, Building2, HelpCircle, Download, CreditCard, Megaphone, UserCheck,
  Bell, BellOff, CalendarDays, Folder, ListChecks
} from 'lucide-react';
import logo from '../assets/logo.png';
import { usePushNotifications } from '../hooks/usePushNotifications';
import { isProfessor } from '../lib/roles';

export default function Layout() {
  const [profile, setProfile] = useState<any>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [hasUnreadAnnouncements, setHasUnreadAnnouncements] = useState(false);
  const [hasUnreadEvents, setHasUnreadEvents] = useState(false);
  const [pendingValidations, setPendingValidations] = useState(0);
  const { isSupported, isSubscribed, subscribe, unsubscribe } = usePushNotifications(profile?.id);
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
        .select('*, school:schools!school_id(name, head_professor_id, payment_management_enabled), assigned_professor:profiles!assigned_professor_id(full_name)')
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

  // Verificar avisos não lidos
  useEffect(() => {
    if (!profile) return;
    async function checkUnread() {
      const { data } = await supabase
        .from('announcements')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        const lastSeenKey = `announcements_last_seen_${profile.id}`;
        const lastSeen = localStorage.getItem(lastSeenKey);
        const latestTs = new Date(data.created_at).getTime();
        if (!lastSeen || latestTs > parseInt(lastSeen)) {
          setHasUnreadAnnouncements(true);
        } else {
          setHasUnreadAnnouncements(false);
        }
      }
    }
    checkUnread();

    // Limpar badge se o utilizador está na página de avisos
    if (location.pathname === '/avisos') {
      if (profile?.id) {
        localStorage.setItem(`announcements_last_seen_${profile.id}`, Date.now().toString());
        setHasUnreadAnnouncements(false);
      }
    }
  }, [profile, location.pathname]);

  // Verificar eventos não lidos
  useEffect(() => {
    if (!profile) return;
    async function checkUnreadEvents() {
      let query = supabase
        .from('events')
        .select('created_at, school_id')
        .order('created_at', { ascending: false })
        .limit(1);

      if (profile.role !== 'Admin') {
         query = query.or(`school_id.is.null,school_id.eq.${profile.school_id}`);
      }
      
      const { data } = await query.single();

      if (data) {
        const lastSeenKey = `events_last_seen_${profile.id}`;
        const lastSeen = localStorage.getItem(lastSeenKey);
        const latestTs = new Date(data.created_at).getTime();
        if (!lastSeen || latestTs > parseInt(lastSeen)) {
          setHasUnreadEvents(true);
        } else {
          setHasUnreadEvents(false);
        }
      }
    }
    checkUnreadEvents();

    if (location.pathname === '/eventos') {
      if (profile?.id) {
        localStorage.setItem(`events_last_seen_${profile.id}`, Date.now().toString());
        setHasUnreadEvents(false);
      }
    }
  }, [profile, location.pathname]);

  // Verificar validações pendentes (para badge)
  useEffect(() => {
    if (!profile) return;
    if (profile.role !== 'Admin' && profile.role !== 'Professor') return;
    async function checkPendingValidations() {
      const isHeadProfessor = profile?.school?.head_professor_id === profile?.id;
      if (profile.role !== 'Admin' && !isHeadProfessor) return;

      let query = supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('needs_validation', true)
        .eq('role', 'Atleta');

      if (isProfessor(profile.role) && profile.school_id) {
        query = query.eq('school_id', profile.school_id);
      }

      const { count } = await query;
      setPendingValidations(count || 0);
    }
    checkPendingValidations();
  }, [profile, location.pathname]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const navItems = profile?.role === 'Atleta'
    ? [
      { name: 'Dashboard', path: '/dashboard', icon: Home },
      { name: 'Aulas', path: '/aulas', icon: Calendar },
      { name: 'Eventos', path: '/eventos', icon: CalendarDays, badge: hasUnreadEvents },
      { name: 'Documentos', path: '/documentos', icon: Folder },
      { name: 'Avisos', path: '/avisos', icon: Megaphone, badge: hasUnreadAnnouncements },
      { name: 'Área Pessoal', path: '/settings', icon: Settings },
    ]
    : [
      { name: 'Dashboard', path: '/dashboard', icon: Activity },
      { name: 'Gestão de Aulas', path: '/admin/aulas', icon: Calendar },
      ...(isProfessor(profile?.role) ? [{ name: 'Aulas', path: '/aulas', icon: Calendar }] : []),
      { name: 'Eventos', path: '/eventos', icon: CalendarDays, badge: hasUnreadEvents },
      { name: 'Avisos', path: '/avisos', icon: Megaphone, badge: hasUnreadAnnouncements },
      { name: 'Atletas', path: '/admin/atletas', icon: Users },
      ...(profile?.role === 'Admin' ? [{ name: 'Gestão de Escolas', path: '/admin/escolas', icon: Building2 }] : []),
      ...((profile?.role === 'Admin' || (isProfessor(profile?.role) && profile?.school?.payment_management_enabled !== false)) ? [{ name: 'Pagamentos', path: '/admin/pagamentos', icon: CreditCard }] : []),
      { name: 'Check-in', path: '/admin/checkin', icon: ShieldCheck },
      { name: 'Marcações', path: profile?.role === 'Admin' ? '/admin/marcacoes' : '/marcacoes', icon: ListChecks },
      ...((profile?.role === 'Admin' || profile?.school?.head_professor_id === profile?.id) ? [{ name: 'Validações', path: '/admin/validacoes', icon: UserCheck, badge: pendingValidations > 0 }] : []),
      { name: 'Documentos', path: '/documentos', icon: Folder },
      { name: 'Definições', path: '/settings', icon: Settings },
    ];

  if (!profile) return <div className="loading-state">A carregar perfil...</div>;

  // BLOQUEIO: Utilizador ainda aguarda validação pelo admin/professor
  if (profile.needs_validation === true) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-dark)', padding: '1.5rem'
      }}>
        <div style={{
          background: 'var(--bg-card)', border: '1px solid rgba(245,158,11,0.3)',
          borderRadius: '1.5rem', padding: '3rem 2rem', maxWidth: '420px', width: '100%',
          textAlign: 'center', boxShadow: '0 25px 60px rgba(0,0,0,0.5)'
        }}>
          <img src={logo} alt="ZR Team" style={{ width: '90px', height: '90px', borderRadius: '50%', border: '2px solid #f59e0b', padding: '4px', background: 'white', marginBottom: '1.5rem' }} />
          <div style={{ fontSize: '3rem', marginBottom: '0.75rem' }}>⏳</div>
          <h2 style={{ color: 'white', margin: '0 0 0.75rem', fontSize: '1.25rem' }}>A aguardar validação</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '2rem' }}>
            O teu registo está pendente de aprovação pelo professor responsável ou administrador.
            Receberás acesso assim que a tua conta for validada.
          </p>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.75rem', padding: '0.875rem', marginBottom: '2rem', fontSize: '0.8rem', color: '#f59e0b' }}>
            📧 Se tiveres dúvidas, contacta o teu professor ou via <strong>zrteamcheck@gmail.com</strong>
          </div>
          <button
            onClick={handleSignOut}
            style={{
              background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
              padding: '0.6rem 1.5rem', borderRadius: '0.5rem', cursor: 'pointer',
              fontSize: '0.875rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <LogOut size={16} /> Sair da conta
          </button>
        </div>
      </div>
    );
  }

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
              <span style={{ flex: 1 }}>{item.name}</span>
              {(item as any).badge && (
                <span className="nav-badge-dot" title="Tens avisos não lidos" />
              )}
            </Link>
          ))}
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
          {/* Botão de Notificações Push */}
          {isSupported && (
            <button
              onClick={isSubscribed ? unsubscribe : subscribe}
              className="nav-link install-nav-btn"
              title={isSubscribed ? 'Desativar notificações' : 'Ativar notificações push'}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}
            >
              {isSubscribed ? <BellOff size={20} /> : <Bell size={20} />}
              {isSubscribed ? 'Notificações ativas' : 'Ativar notificações'}
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
          <p><a href="https://tatamecontrol.netlify.app/" target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>Tatame Control</a></p>
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
          overflow-y: auto;
          scrollbar-width: thin;
          scrollbar-color: rgba(255,255,255,0.1) transparent;
        }
        .sidebar-nav::-webkit-scrollbar {
          width: 4px;
        }
        .sidebar-nav::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
          border-radius: 10px;
        }
        .nav-link {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.75rem 1.5rem;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .nav-badge-dot {
          width: 9px;
          height: 9px;
          border-radius: 50%;
          background: #ef4444;
          flex-shrink: 0;
          box-shadow: 0 0 6px rgba(239, 68, 68, 0.8);
          animation: badge-pulse 2s infinite;
        }
        @keyframes badge-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.7; transform: scale(1.2); }
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
            max-height: 100vh;
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
            padding: 1.5rem 1rem 1rem 1rem;
          }
          .sidebar-logo {
            width: 60px;
            height: 60px;
          }
          .nav-link {
            padding: 0.65rem 1.25rem;
            font-size: 0.9rem;
          }
          .sidebar-footer {
            padding: 1rem;
          }
          .zr-credits {
            padding: 0.75rem 1rem;
            font-size: 0.6rem;
          }
        }
      `}</style>
    </div>
  );
}
