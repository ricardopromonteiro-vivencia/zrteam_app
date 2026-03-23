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

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  // Auto-refresh logic (10 minutes)
  useEffect(() => {
    let backgroundTime: number | null = null;
    const TEN_MINUTES_MS = 10 * 60 * 1000;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // App foi minimizada/suspensa
        backgroundTime = Date.now();
      } else {
        // App voltou a ser visível
        if (backgroundTime) {
          const timeInBackground = Date.now() - backgroundTime;
          if (timeInBackground > TEN_MINUTES_MS) {
            // Se passou demasiado tempo em background, força hard-refresh para puxar updates
            window.location.reload();
          }
          backgroundTime = null; // Reset
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#121212', color: '#10b981' }}>A carregar o tatame...</div>;
  }

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
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
