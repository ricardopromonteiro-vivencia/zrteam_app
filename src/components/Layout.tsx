import { useEffect, useState } from 'react';
import { Outlet, useNavigate, Link, useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Home, Calendar, Users, Activity } from 'lucide-react';

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

      const { data, error: _error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (data) setProfile(data);
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
    ]
    : [
      { name: 'Dashboard', path: '/dashboard', icon: Activity },
      { name: 'Gestão de Aulas', path: '/admin/aulas', icon: Calendar },
      { name: 'Check-in', path: '/admin/checkin', icon: Users },
    ];

  if (!profile) return <div className="loading-state">A carregar perfil...</div>;

  return (
    <div className="layout-container">
      <nav className="sidebar">
        <div className="sidebar-header">
          <h2>ZR Team</h2>
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
