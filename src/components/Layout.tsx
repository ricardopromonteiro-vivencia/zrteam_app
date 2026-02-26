import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Home, Calendar, Users, Activity, Settings, ShieldCheck } from 'lucide-react';
import logo from '../assets/logo.png';

export default function Layout() {
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    async function loadSession() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/');
        return;
      }

      let { data, error } = await supabase
        .from('profiles')
        .select('*')
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
      { name: 'Check-in', path: '/admin/checkin', icon: Activity },
      { name: 'Definições', path: '/settings', icon: Settings },
    ];

  if (!profile) return <div className="loading-state">A carregar perfil...</div>;

  return (
    <div className="layout-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <img src={logo} alt="ZR Team" className="sidebar-logo" />
          <span className="role-badge">{profile.role}</span>
        </div>

        <div className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
            >
              <item.icon size={20} />
              {item.name}
            </Link>
          ))}
          <Link to="/termos" className="nav-link terms-nav-link">
            <ShieldCheck size={20} /> Termos e Condições
          </Link>
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
        .sidebar {
          width: 250px;
          background-color: var(--bg-card);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
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
        .sidebar-footer {
          padding: 1.5rem;
          border-top: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: space-between;
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
        @media (max-width: 768px) {
          .layout-container {
            flex-direction: column;
          }
          .sidebar {
            width: 100%;
            height: auto;
            border-right: none;
            border-bottom: 1px solid var(--border);
          }
          .sidebar-nav {
            display: flex;
            overflow-x: auto;
            padding: 0.5rem;
          }
          .sidebar-header, .sidebar-footer {
            padding: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
