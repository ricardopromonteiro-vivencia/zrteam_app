import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Activity, Calendar, Clock, ExternalLink, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';

const GRADUATION_RULES: Record<string, { totalForNextBelt: number, classesPerDegree: number, nextBelt: string }> = {
  'Cinza/ branco': { totalForNextBelt: 40, classesPerDegree: 8, nextBelt: 'Cinza' },
  'Cinza': { totalForNextBelt: 40, classesPerDegree: 8, nextBelt: 'Cinza/ Preto' },
  'Cinza/ Preto': { totalForNextBelt: 40, classesPerDegree: 8, nextBelt: 'Amarelo / Branco' },
  'Amarelo / Branco': { totalForNextBelt: 50, classesPerDegree: 10, nextBelt: 'Amarelo' },
  'Amarelo': { totalForNextBelt: 50, classesPerDegree: 10, nextBelt: 'Amarelo/ preto' },
  'Amarelo/ preto': { totalForNextBelt: 50, classesPerDegree: 10, nextBelt: 'Laranja/ Branco' },
  'Laranja/ Branco': { totalForNextBelt: 60, classesPerDegree: 12, nextBelt: 'Laranja' },
  'Laranja': { totalForNextBelt: 60, classesPerDegree: 12, nextBelt: 'Laranja/ preto' },
  'Laranja/ preto': { totalForNextBelt: 60, classesPerDegree: 12, nextBelt: 'Verde / Branco' },
  'Verde / Branco': { totalForNextBelt: 70, classesPerDegree: 14, nextBelt: 'Verde' },
  'Verde': { totalForNextBelt: 70, classesPerDegree: 14, nextBelt: 'Verde / Preto' },
  'Verde / Preto': { totalForNextBelt: 70, classesPerDegree: 14, nextBelt: 'Branco' },
  'Branco': { totalForNextBelt: 120, classesPerDegree: 25, nextBelt: 'Azul' },
  'Azul': { totalForNextBelt: 250, classesPerDegree: 55, nextBelt: 'Roxa' },
  'Roxo': { totalForNextBelt: 375, classesPerDegree: 85, nextBelt: 'Marrom' },
  'Marrom': { totalForNextBelt: 500, classesPerDegree: 115, nextBelt: 'Preto' },
  'Preto': { totalForNextBelt: 1000, classesPerDegree: 200, nextBelt: 'Preto' }
};

export default function Dashboard() {
  const { profile } = useOutletContext<{ profile: any }>();
  const [stats, setStats] = useState({
    weekClasses: 0,
    nextClasses: [] as any[],
    weeklyAttendance: [] as { day: string, count: number }[]
  });
  const [loading, setLoading] = useState(true);
  const [checkinStep, setCheckinStep] = useState<'idle' | 'locating' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
    }
  }, [profile]);

  async function fetchDashboardData() {
    setLoading(true);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    // 1. Aulas da semana
    const { count: weekCount } = await supabase
      .from('class_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .gte('created_at', startOfWeek.toISOString());

    // 2. Próximas aulas marcadas
    const { data: bookings } = await supabase
      .from('class_bookings')
      .select(`
                id,
                status,
                classes (
                    id,
                    title,
                    date,
                    start_time,
                    end_time
                )
            `)
      .eq('user_id', profile.id)
      .eq('status', 'Marcado')
      .gte('classes.date', now.toISOString().split('T')[0])
      .order('classes(date)', { ascending: true })
      .limit(3);

    // 3. Afluência semanal (para Admin/Professor)
    if (profile.role !== 'Atleta') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);

      let attendanceQuery = supabase
        .from('class_bookings')
        .select('created_at')
        .eq('status', 'Presente')
        .gte('created_at', sevenDaysAgo.toISOString());

      if (profile.role === 'Professor') {
        attendanceQuery = attendanceQuery.eq('profiles!inner(school_id)', profile.school_id);
      }

      const { data: attendanceData } = await attendanceQuery;

      if (attendanceData) {
        const counts: Record<string, number> = {};
        for (let i = 0; i < 7; i++) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          counts[d.toLocaleDateString('pt-PT', { weekday: 'short' })] = 0;
        }

        attendanceData.forEach(b => {
          const day = new Date(b.created_at).toLocaleDateString('pt-PT', { weekday: 'short' });
          if (day in counts) counts[day]++;
        });

        const weeklyAttendance = Object.entries(counts).map(([day, count]) => ({ day, count })).reverse();
        setStats(prev => ({ ...prev, weeklyAttendance }));
      }
    }

    setStats(prev => ({
      ...prev,
      weekClasses: weekCount || 0,
      nextClasses: bookings?.map((b: any) => ({ ...b.classes, booking_id: b.id })).filter(Boolean) || []
    }));
    setLoading(false);
  }

  const handleSecureCheckin = async () => {
    setCheckinStep('locating');
    setErrorMessage('');

    try {
      // 1. Obter Localização com Timeout de 10s
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 30000,
          maximumAge: 0
        });
      });

      // 2. Obter IP
      const ipResponse = await fetch('https://api.ipify.org?format=json');
      const ipData = await ipResponse.json();

      // 3. Chamar RPC
      const { data, error: rpcError } = await supabase.rpc('secure_checkin', {
        p_lat: position.coords.latitude,
        p_lng: position.coords.longitude,
        p_client_ip: ipData.ip
      });

      if (rpcError) throw rpcError;

      if (data?.success) {
        setCheckinStep('success');
        setTimeout(() => {
          setCheckinStep('idle');
          fetchDashboardData();
        }, 3000);
      } else {
        setCheckinStep('error');
        setErrorMessage(data?.error || 'Falha no check-in');
      }
    } catch (err: any) {
      setCheckinStep('error');
      setErrorMessage(
        err.code === 1 ? 'Permissão de GPS negada. Ativa a localização no browser.' :
          err.code === 3 ? 'Tempo de espera do GPS esgotado. Tenta num local mais aberto.' :
            'Erro ao obter localização. Garante que tens o GPS ligado.'
      );
    }
  };

  if (!profile) return null;

  const rule = GRADUATION_RULES[profile.belt] || GRADUATION_RULES['Branca'];
  const progressPercent = Math.min(100, Math.round((profile.attended_classes / rule.totalForNextBelt) * 100));
  const classesUntilNextDegree = rule.classesPerDegree - (profile.attended_classes % rule.classesPerDegree);
  const classesUntilNextBelt = rule.totalForNextBelt - profile.attended_classes;

  const getCalendarLinks = (cls: any) => {
    const start = (cls.date?.replace(/-/g, '') || '') + 'T' + (cls.start_time?.replace(/:/g, '') || '') + '00Z';
    const end = (cls.date?.replace(/-/g, '') || '') + 'T' + (cls.end_time?.replace(/:/g, '') || '') + '00Z';
    const title = encodeURIComponent((cls.title || 'Aula') + ' - ZR Team');

    const google = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`;
    const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${cls.date}T${cls.start_time}&enddt=${cls.date}T${cls.end_time}`;

    return { google, outlook };
  };

  if (profile.role === 'Admin' || profile.role === 'Professor') {
    return (
      <div className="dashboard animate-fade-in">
        <header className="dashboard-welcome">
          <h1 className="page-title">Olá, Professor {profile.full_name.split(' ')[0]}!</h1>
          <p className="welcome-text">Pronto para liderar o tatame hoje?</p>
        </header>

        <div className="stats-grid">
          <div className="stat-card">
            <Activity className="stat-icon" />
            <div className="stat-content">
              <h3>Aulas Lecionadas</h3>
              <p className="stat-value">{profile.attended_classes}</p>
            </div>
          </div>
          <div className="stat-card">
            <Users className="stat-icon" />
            <div className="stat-content">
              <h3>Alunos na Escola</h3>
              <p className="stat-value">{profile.school?.name || 'Várias'}</p>
            </div>
          </div>
        </div>

        <div className="chart-container">
          <h3 className="chart-title">Afluência de Alunos (Últimos 7 dias)</h3>
          <div className="bar-chart">
            {stats.weeklyAttendance.map((item, idx) => (
              <div key={idx} className="bar-wrapper">
                <div className="bar-label">{item.count}</div>
                <div
                  className="bar-fill"
                  style={{ height: `${Math.max(10, (item.count / (Math.max(...stats.weeklyAttendance.map(a => a.count)) || 1)) * 100)}%` }}
                ></div>
                <div className="bar-day">{item.day}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard animate-fade-in">
      <header className="dashboard-welcome">
        <h1 className="page-title">Olá, {profile.full_name.split(' ')[0]}!</h1>
        <p className="welcome-text">Bora completar mais um treino de hoje?</p>
      </header>

      <div className="stats-grid">
        <div className="stat-card">
          <Activity className="stat-icon" />
          <div className="stat-content">
            <h3>Total de Presenças</h3>
            <p className="stat-value">{profile.attended_classes}</p>
          </div>
        </div>
        <div className="stat-card">
          <Calendar className="stat-icon" />
          <div className="stat-content">
            <h3>Aulas esta Semana</h3>
            <p className="stat-value">{loading ? '...' : stats.weekClasses}</p>
          </div>
        </div>
      </div>

      <div className="dashboard-grid">
        <div className="progression-column">
          <div className="progression-card">
            <div className="progression-header">
              <div>
                <h2 className="progression-title">Progressão: Faixa {profile.belt}</h2>
                <p className="progression-subtitle">Atualmente com {profile.degrees} Graus</p>
              </div>
              <div className="belt-badge">
                <span className={`belt-color belt-${profile.belt.toLowerCase()}`}></span>
              </div>
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div className="progress-labels">
                <span>{profile.attended_classes} Aulas</span>
                <span>{rule.totalForNextBelt} Aulas para Faixa {rule.nextBelt}</span>
              </div>
            </div>

            <div className="next-milestone">
              <p>Faltam <strong>{classesUntilNextDegree}</strong> aulas para o próximo grau.</p>
              <p>Faltam <strong>{classesUntilNextBelt}</strong> aulas para a Faixa {rule.nextBelt}.</p>
            </div>
          </div>

          <div className="secure-checkin-banner">
            <div className="banner-content">
              <h3>Presença Inteligente</h3>
              <p>Confirmamos a tua presença automaticamente através da tua localização (GPS).</p>
            </div>
            <button
              className={`btn-secure-checkin step-${checkinStep}`}
              onClick={handleSecureCheckin}
              disabled={checkinStep === 'locating' || checkinStep === 'success'}
            >
              {checkinStep === 'locating' ? (
                <span className="loading-spinner">A aguardar localização...</span>
              ) : checkinStep === 'success' ? (
                '✅ Check-in Concluído!'
              ) : (
                'Confirmar Presença'
              )}
            </button>
            {checkinStep === 'error' && <p className="checkin-error-text">{errorMessage}</p>}
          </div>
        </div>

        <div className="agenda-column">
          <div className="agenda-card">
            <div className="agenda-header">
              <h2 className="agenda-title">As Minhas Próximas Aulas</h2>
              <Link to="/aulas" className="agenda-link">Ver todas</Link>
            </div>

            {loading ? (
              <p className="loading-small">A carregar agenda...</p>
            ) : stats.nextClasses.length === 0 ? (
              <div className="agenda-empty">
                <p>Ainda não tens aulas marcadas.</p>
                <Link to="/aulas" className="btn-secondary-sm">Marcar Aula</Link>
              </div>
            ) : (
              <div className="agenda-list">
                {stats.nextClasses.map(cls => {
                  const links = getCalendarLinks(cls);
                  return (
                    <div key={cls.id} className="agenda-item">
                      <div className="agenda-item-info">
                        <h4>{cls.title}</h4>
                        <p><Calendar size={12} /> {cls.date}</p>
                        <p><Clock size={12} /> {cls.start_time?.substring(0, 5) || '--:--'}</p>
                      </div>
                      <div className="agenda-actions">
                        <div className="dropdown">
                          <button className="btn-calendar-trigger">
                            <ExternalLink size={14} /> Calendário
                          </button>
                          <div className="dropdown-menu">
                            <a href={links.google} target="_blank" rel="noreferrer">Google Calendar</a>
                            <a href={links.outlook} target="_blank" rel="noreferrer">Outlook</a>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
                .dashboard { max-width: 1200px; margin: 0 auto; }
                .page-title { font-size: 1.875rem; font-weight: 700; margin-bottom: 2rem; color: white; }
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.5rem; margin-bottom: 2rem; }
                .stat-card { background: var(--bg-card); padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border); display: flex; align-items: center; gap: 1rem; }
                .stat-icon { width: 48px; height: 48px; padding: 12px; border-radius: 0.75rem; background: rgba(16, 185, 129, 0.1); color: var(--primary); }
                .stat-content h3 { font-size: 0.875rem; color: var(--text-muted); font-weight: 500; margin-bottom: 0.25rem; }
                .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--text-main); }
                
                .dashboard-welcome { margin-bottom: 2rem; }
                .welcome-text { color: var(--text-muted); font-size: 1rem; margin-top: -1.5rem; }

                .chart-container { background: var(--bg-card); padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border); margin-top: 1.5rem; }
                .chart-title { font-size: 1rem; color: white; margin-bottom: 2rem; }
                .bar-chart { display: flex; align-items: flex-end; justify-content: space-around; height: 150px; padding-top: 2rem; }
                .bar-wrapper { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; flex: 1; }
                .bar-fill { width: 30px; background: linear-gradient(180deg, var(--primary) 0%, rgba(16, 185, 129, 0.3) 100%); border-radius: 4px 4px 0 0; transition: height 0.3s ease; }
                .bar-label { font-size: 0.75rem; color: var(--primary); font-weight: 700; }
                .bar-day { font-size: 0.7rem; color: var(--text-muted); text-transform: capitalize; }

                .checkin-error-text { color: var(--danger); font-size: 0.75rem; margin-top: 0.5rem; text-align: center; }
                .loading-spinner { display: flex; align-items: center; gap: 0.5rem; }
                .btn-secure-checkin.step-locating { background: var(--border); color: var(--text-muted); }
                .btn-secure-checkin.step-success { background: #10b981; }
                
                .dashboard-grid { display: grid; grid-template-columns: 1fr 350px; gap: 1.5rem; align-items: start; }
                .progression-card, .agenda-card { background: var(--bg-card); padding: 1.5rem; border-radius: 1rem; border: 1px solid var(--border); }
                
                .progression-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
                .progression-title { font-size: 1.25rem; font-weight: 600; color: white; margin-bottom: 0.25rem; }
                .progression-subtitle { color: var(--text-muted); font-size: 0.875rem; }
                .belt-badge { width: 60px; height: 12px; border-radius: 4px; background: #222; border: 1px solid #444; overflow: hidden; }
                .belt-color { display: block; width: 100%; height: 100%; }
                .belt-branca { background: #fff; }
                .belt-azul { background: #2563eb; }
                .belt-roxa { background: #9333ea; }
                .belt-marrom { background: #78350f; }
                .belt-preta { background: #000; }

                .progress-bar-track { height: 10px; background: #374151; border-radius: 9999px; overflow: hidden; margin-bottom: 0.5rem; }
                .progress-bar-fill { height: 100%; background: var(--primary); border-radius: 9999px; transition: width 1s ease-out; }
                .progress-labels { display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem; }
                .next-milestone { background: rgba(16, 185, 129, 0.05); border-radius: 0.5rem; padding: 1rem; border: 1px solid rgba(16, 185, 129, 0.1); }
                .next-milestone p { font-size: 0.875rem; margin-bottom: 0.25rem; color: var(--text-main); }
                .next-milestone strong { color: var(--primary); }

                .secure-checkin-banner { 
                    margin-top: 1.5rem; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
                    border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 1rem; padding: 1.5rem; display: flex; 
                    justify-content: space-between; align-items: center; gap: 1.5rem;
                }
                .banner-content h3 { font-size: 1.125rem; color: var(--primary); font-weight: 600; margin-bottom: 0.25rem; }
                .banner-content p { font-size: 0.875rem; color: var(--text-muted); }
                .btn-secure-checkin { 
                    background: var(--primary); color: white; padding: 0.75rem 1.25rem; border-radius: 0.5rem; 
                    font-weight: 700; border: none; cursor: pointer; transition: all 0.2s; white-space: nowrap;
                }
                .btn-secure-checkin:hover { background: var(--primary-dark); transform: translateY(-1px); }
                .btn-secure-checkin:disabled { opacity: 0.7; cursor: not-allowed; }
                .btn-secure-checkin.loading { animation: pulse 1s infinite; }

                .agenda-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
                .agenda-title { font-size: 1.125rem; font-weight: 600; color: white; }
                .agenda-link { font-size: 0.75rem; color: var(--primary); text-decoration: none; font-weight: 500; }
                .agenda-empty { text-align: center; padding: 2rem 0; color: var(--text-muted); font-size: 0.875rem; }
                .btn-secondary-sm { display: inline-block; margin-top: 1rem; padding: 0.5rem 1rem; background: rgba(16, 185, 129, 0.1); color: var(--primary); border-radius: 0.5rem; text-decoration: none; font-weight: 600; transition: background 0.2s; }
                .btn-secondary-sm:hover { background: rgba(16, 185, 129, 0.2); }
                
                .agenda-list { display: flex; flex-direction: column; gap: 0.75rem; }
                .agenda-item { background: rgba(255, 255, 255, 0.02); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; }
                .agenda-item-info h4 { font-size: 0.9375rem; color: white; margin-bottom: 0.25rem; }
                .agenda-item-info p { display: flex; align-items: center; gap: 0.5rem; font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.125rem; }
                
                .agenda-actions { position: relative; }
                .btn-calendar-trigger { background: transparent; border: 1px solid var(--border); color: var(--text-muted); font-size: 11px; padding: 0.25rem 0.5rem; border-radius: 0.375rem; display: flex; align-items: center; gap: 0.25rem; cursor: pointer; }
                .btn-calendar-trigger:hover { border-color: var(--primary); color: var(--primary); }
                
                .dropdown { position: relative; }
                .dropdown-menu { display: none; position: absolute; right: 0; top: 100%; margin-top: 0.5rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 0.5rem; min-width: 140px; z-index: 100; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); }
                .dropdown:hover .dropdown-menu { display: block; }
                .dropdown-menu a { display: block; padding: 0.625rem 1rem; font-size: 0.75rem; color: var(--text-main); text-decoration: none; border-bottom: 1px solid rgba(255,255,255,0.02); }
                .dropdown-menu a:last-child { border-bottom: none; }
                .dropdown-menu a:hover { background: rgba(255,255,255,0.05); color: var(--primary); }

                @media (max-width: 1024px) {
                    .dashboard-grid { grid-template-columns: 1fr; }
                }
            `}</style>
    </div>
  );
}
