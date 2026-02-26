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

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

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

        {/* Rotas Protegidas com Layout */}
        <Route element={session ? <Layout /> : <Navigate to="/" />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/aulas" element={<Classes />} />
          <Route path="/admin/aulas" element={<Classes />} />
          <Route path="/admin/checkin" element={<CheckIn />} />
          <Route path="/admin/atletas" element={<Athletes />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
