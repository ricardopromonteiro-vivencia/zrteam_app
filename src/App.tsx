import { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabase';

// Pages
import Login from './pages/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Classes from './pages/Classes';
import CheckIn from './pages/CheckIn';
import Athletes from './pages/Athletes';
import Settings from './pages/Settings';
import Terms from './pages/Terms';
import Help from './pages/Help';
import Schools from './pages/Schools';
import Payments from './pages/Payments';
import Announcements from './pages/Announcements';
import ResetPassword from './pages/ResetPassword';
import Validations from './pages/Validations';
import Events from './pages/Events';
import Documents from './pages/Documents';
import Attendances from './pages/Attendances';
import Store from './pages/Store';
import MyOrders from './pages/MyOrders';
import StoreManagement from './pages/admin/StoreManagement';
import OrderManagement from './pages/admin/OrderManagement';
import ExternalEvents from './pages/admin/ExternalEvents';
import Rankings from './pages/Rankings';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-refresh ao voltar do background (2 minutos)
  useEffect(() => {
    let backgroundTime: number | null = null;
    const TWO_MINUTES_MS = 2 * 60 * 1000;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App foi minimizada/suspensa
        backgroundTime = Date.now();
      } else {
        // App voltou a ser visível
        if (backgroundTime) {
          const timeInBackground = Date.now() - backgroundTime;
          backgroundTime = null; // Reset

          if (timeInBackground > TWO_MINUTES_MS) {
            // Verifica se existe novo SW (novo deploy) antes de recarregar
            if ('serviceWorker' in navigator) {
              navigator.serviceWorker.getRegistration().then(reg => {
                if (reg) {
                  reg.update().then(() => {
                    // O controllerchange em main.tsx trata do reload se houver update
                    // Se não houver SW novo, recarregamos na mesma para refrescar sessão
                    if (!reg.installing && !reg.waiting) {
                      window.location.reload();
                    }
                  });
                } else {
                  window.location.reload();
                }
              }).catch(() => window.location.reload());
            } else {
              window.location.reload();
            }
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        // Token de sessão inválido — limpar storage e forçar novo login
        supabase.auth.signOut();
      }
      setSession(session);
      setLoading(false);
      // Sinalizar ao splash screen que a app está pronta
      window.dispatchEvent(new Event('zr:appready'));
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // O splash screen serve de loading — não é necessário div extra
  if (loading) return null;

  return (
    <Router>
      <Routes>
        <Route
          path="/"
          element={!session ? <Login /> : <Navigate to="/dashboard" />}
        />
        <Route path="/termos" element={<Terms />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Rotas Protegidas com Layout */}
        <Route element={session ? <Layout /> : <Navigate to="/" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/aulas" element={<Classes />} />
          <Route path="/admin/aulas" element={<Classes />} />
          <Route path="/avisos" element={<Announcements />} />
          <Route path="/admin/checkin" element={<CheckIn />} />
          <Route path="/admin/atletas" element={<Athletes />} />
          <Route path="/admin/escolas" element={<Schools />} />
          <Route path="/admin/pagamentos" element={<Payments />} />
          <Route path="/checkin" element={<CheckIn />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/ajuda" element={<Help />} />
          <Route path="/admin/validacoes" element={<Validations />} />
          <Route path="/validacoes" element={<Validations />} />
          <Route path="/eventos" element={<Events />} />
          <Route path="/documentos" element={<Documents />} />
          <Route path="/marcacoes" element={<Attendances />} />
          <Route path="/admin/marcacoes" element={<Attendances />} />
          <Route path="/loja" element={<Store />} />
          <Route path="/minhas-encomendas" element={<MyOrders />} />
          <Route path="/admin/loja" element={<StoreManagement />} />
          <Route path="/admin/encomendas" element={<OrderManagement />} />
          <Route path="/admin/eventos-externos" element={<ExternalEvents />} />
          <Route path="/rankings" element={<Rankings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
