import { useEffect, useState } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Activity, Calendar, Clock, ExternalLink } from 'lucide-react';
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
  'Branco': { totalForNextBelt: 220, classesPerDegree: 55, nextBelt: 'Azul' },
  'Azul': { totalForNextBelt: 300, classesPerDegree: 75, nextBelt: 'Roxa' },
  'Roxo': { totalForNextBelt: 300, classesPerDegree: 75, nextBelt: 'Marrom' },
  'Marrom': { totalForNextBelt: 280, classesPerDegree: 70, nextBelt: 'Preto' },
  'Preto': { totalForNextBelt: 1000, classesPerDegree: 200, nextBelt: 'Preto' }
};

export default function Dashboard() {
  const { profile } = useOutletContext<{ profile: any }>();
  const [stats, setStats] = useState({
    weekClasses: 0,
    nextClasses: [] as any[],
    weeklyAttendance: [] as { day: string, count: number }[],
    totalAthletes: 0,
    todayClasses: [] as any[],
    totalPresent: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
      checkRecurringClasses();
    }
  }, [profile]);

  async function checkRecurringClasses() {
    if (profile.role === 'Atleta') return;

    // Buscar aulas recorrentes do passado recente (até 7 dias atrás)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const { data: recurringClasses } = await supabase
      .from('classes')
      .select('*')
      .eq('is_recurring', true)
      .gte('date', weekAgo.toISOString().split('T')[0])
      .lte('date', new Date().toISOString().split('T')[0]);

    if (!recurringClasses) return;

    for (const cls of recurringClasses) {
      // Calcular a data da próxima semana
      const nextDate = new Date(cls.date);
      nextDate.setDate(nextDate.getDate() + 7);
      const nextDateStr = nextDate.toISOString().split('T')[0];

      // Verificar se já existe a aula para a próxima semana
      const { data: existing } = await supabase
        .from('classes')
        .select('id')
        .eq('title', cls.title)
        .eq('date', nextDateStr)
        .eq('start_time', cls.start_time)
        .eq('school_id', cls.school_id)
        .maybeSingle();

      if (!existing) {
        // Criar a aula para a próxima semana
        await supabase.from('classes').insert([{
          title: cls.title,
          date: nextDateStr,
          start_time: cls.start_time,
          end_time: cls.end_time,
          capacity: cls.capacity,
          professor_id: cls.professor_id,
          school_id: cls.school_id,
          is_recurring: true
        }]);
      }
    }
  }

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

    // 3. Extra stats for Admin/Professor
    if (profile.role !== 'Atleta') {
      const today = now.toISOString().split('T')[0];
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

      // Aulas de hoje
      let todayQuery = supabase
        .from('classes')
        .select('id, title, start_time, end_time, class_bookings(count)')
        .eq('date', today);
      if (profile.role === 'Professor' && profile.school_id) {
        todayQuery = todayQuery.eq('school_id', profile.school_id);
      }
      const { data: todayClassesData } = await todayQuery.order('start_time', { ascending: true });

      // Total de presenças hoje
      const { count: presentToday } = await supabase
        .from('class_bookings')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Presente')
        .gte('created_at', today);

      // Total de atletas
      let athleteQuery = supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'Atleta');
      if (profile.role === 'Professor' && profile.school_id) {
        athleteQuery = athleteQuery.eq('school_id', profile.school_id);
      }
      const { count: athleteCount } = await athleteQuery;

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
        setStats(prev => ({
          ...prev,
          weeklyAttendance,
          totalAthletes: athleteCount || 0,
          todayClasses: todayClassesData || [],
          totalPresent: presentToday || 0
        }));
      }
    }

    setStats(prev => ({
      ...prev,
      weekClasses: weekCount || 0,
      nextClasses: bookings?.map((b: any) => ({ ...b.classes, booking_id: b.id })).filter(Boolean) || []
    }));
    setLoading(false);
  }

  if (!profile) return null;

  // Faixa preta: sem próxima faixa
  const isBlackBelt = profile.belt === 'Preto';

  // Atleta menor de 15 anos (calculado pela data de nascimento)
  const isUnder15 = (() => {
    if (!profile.birth_date) return false;
    const birth = new Date(profile.birth_date);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    return age <= 15;
  })();

  const rule = GRADUATION_RULES[profile.belt] || GRADUATION_RULES['Branco'];
  const progressPercent = isBlackBelt ? 100 :
    Math.min(100, Math.round((profile.attended_classes / rule.totalForNextBelt) * 100));
  const classesUntilNextDegree = isBlackBelt ? 0 :
    rule.classesPerDegree - (profile.attended_classes % rule.classesPerDegree);
  const classesUntilNextBelt = isBlackBelt ? 0 :
    Math.max(0, rule.totalForNextBelt - profile.attended_classes);

  const getCalendarLinks = (cls: any) => {
    const start = (cls.date?.replace(/-/g, '') || '') + 'T' + (cls.start_time?.replace(/:/g, '') || '') + '00Z';
    const end = (cls.date?.replace(/-/g, '') || '') + 'T' + (cls.end_time?.replace(/:/g, '') || '') + '00Z';
    const title = encodeURIComponent((cls.title || 'Aula') + ' - ZR Team');

    const google = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}`;
    const outlook = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${cls.date}T${cls.start_time}&enddt=${cls.date}T${cls.end_time}`;

    return { google, outlook };
  };

  if (profile.role === 'Admin' || profile.role === 'Professor') {
    const maxAttendance = Math.max(...stats.weeklyAttendance.map(a => a.count), 1);
    const greeting = profile.role === 'Admin' ? 'Administrador' : 'Professor';
    const timeNow = new Date();
    const hour = timeNow.getHours();
    const timeGreeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';

    return (
      <div className="dashboard animate-fade-in">
        <header className="dashboard-welcome">
          <div>
            <h1 className="page-title">{timeGreeting}, {greeting} {profile.full_name.split(' ')[0]}! 👋</h1>
            <p className="welcome-text">Aqui está o resumo de hoje no tatame.</p>
          </div>
          <div className="admin-school-badge">
            <span className="school-pill">{profile.school?.name || 'ZR Team'}</span>
          </div>
        </header>

        {/* Stat Cards */}
        <div className="admin-stats-grid">
          <div className="admin-stat-card accent-green">
            <div className="admin-stat-icon-wrap">🏅</div>
            <div className="admin-stat-info">
              <p className="admin-stat-label">Atletas</p>
              <p className="admin-stat-value">{loading ? '…' : stats.totalAthletes}</p>
            </div>
          </div>
          <div className="admin-stat-card accent-blue">
            <div className="admin-stat-icon-wrap">📅</div>
            <div className="admin-stat-info">
              <p className="admin-stat-label">Aulas Hoje</p>
              <p className="admin-stat-value">{loading ? '…' : stats.todayClasses.length}</p>
            </div>
          </div>
          <div className="admin-stat-card accent-orange">
            <div className="admin-stat-icon-wrap">✅</div>
            <div className="admin-stat-info">
              <p className="admin-stat-label">Presenças Hoje</p>
              <p className="admin-stat-value">{loading ? '…' : stats.totalPresent}</p>
            </div>
          </div>
          <div className="admin-stat-card accent-purple">
            <div className="admin-stat-icon-wrap">📊</div>
            <div className="admin-stat-info">
              <p className="admin-stat-label">Presenças (7d)</p>
              <p className="admin-stat-value">{loading ? '…' : stats.weeklyAttendance.reduce((s, d) => s + d.count, 0)}</p>
            </div>
          </div>
        </div>

        <div className="admin-dashboard-grid">
          {/* Chart */}
          <div className="admin-card admin-chart-card">
            <h3 className="admin-card-title">📈 Afluência (Últimos 7 dias)</h3>
            <div className="bar-chart">
              {stats.weeklyAttendance.map((item, idx) => (
                <div key={idx} className="bar-wrapper">
                  <div className="bar-label">{item.count}</div>
                  <div
                    className="bar-fill"
                    style={{ height: `${Math.max(6, (item.count / maxAttendance) * 100)}%` }}
                  ></div>
                  <div className="bar-day">{item.day}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Aulas de Hoje */}
          <div className="admin-card">
            <h3 className="admin-card-title">🥋 Aulas de Hoje</h3>
            {stats.todayClasses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', paddingTop: '0.5rem' }}>Nenhuma aula hoje.</p>
            ) : (
              <div className="today-classes-list">
                {stats.todayClasses.map((cls: any) => {
                  const enrolled = cls.class_bookings?.[0]?.count || 0;
                  return (
                    <div key={cls.id} className="today-class-row">
                      <div className="today-class-info">
                        <span className="today-class-title">{cls.title}</span>
                        <span className="today-class-time">⏱ {cls.start_time.substring(0, 5)} – {cls.end_time.substring(0, 5)}</span>
                      </div>
                      <span className="today-class-pill">{enrolled} inscritos</span>
                    </div>
                  );
                })}
              </div>
            )}
            <a href="/checkin" style={{ display: 'block', marginTop: '1rem', fontSize: '0.8rem', color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>→ Ir para Painel de Check-in</a>
          </div>
        </div>

        <style>{`
          .admin-school-badge { align-self: flex-start; }
          .school-pill { background: rgba(16, 185, 129, 0.12); color: var(--primary); border: 1px solid rgba(16,185,129,0.3); padding: 0.35rem 0.9rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 700; }

          .admin-stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
          @media (max-width: 768px) { .admin-stats-grid { grid-template-columns: repeat(2, 1fr); } }
          @media (max-width: 480px) { .admin-stats-grid { grid-template-columns: 1fr 1fr; } }

          .admin-stat-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 1rem;
            padding: 1.25rem;
            display: flex;
            align-items: center;
            gap: 1rem;
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .admin-stat-card:hover { transform: translateY(-3px); box-shadow: 0 8px 25px rgba(0,0,0,0.3); }
          .admin-stat-card.accent-green { border-left: 4px solid #10b981; }
          .admin-stat-card.accent-blue { border-left: 4px solid #3b82f6; }
          .admin-stat-card.accent-orange { border-left: 4px solid #f59e0b; }
          .admin-stat-card.accent-purple { border-left: 4px solid #8b5cf6; }
          .admin-stat-icon-wrap { font-size: 1.75rem; flex-shrink: 0; }
          .admin-stat-label { font-size: 0.75rem; color: var(--text-muted); font-weight: 500; margin-bottom: 0.2rem; }
          .admin-stat-value { font-size: 1.75rem; font-weight: 700; color: white; line-height: 1; }

          .admin-dashboard-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
          @media (max-width: 768px) { .admin-dashboard-grid { grid-template-columns: 1fr; } }

          .admin-card {
            background: var(--bg-card);
            border: 1px solid var(--border);
            border-radius: 1rem;
            padding: 1.5rem;
          }
          .admin-card-title { font-size: 0.95rem; font-weight: 700; color: white; margin-bottom: 1.25rem; }

          .today-classes-list { display: flex; flex-direction: column; gap: 0.75rem; }
          .today-class-row {
            display: flex; justify-content: space-between; align-items: center;
            background: rgba(255,255,255,0.03); border: 1px solid var(--border);
            border-radius: 0.65rem; padding: 0.75rem 1rem;
          }
          .today-class-info { display: flex; flex-direction: column; gap: 0.2rem; }
          .today-class-title { font-weight: 600; font-size: 0.875rem; color: white; }
          .today-class-time { font-size: 0.7rem; color: var(--text-muted); }
          .today-class-pill { background: rgba(16,185,129,0.1); color: var(--primary); border: 1px solid rgba(16,185,129,0.25); padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; }
        `}</style>
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
                <p className="progression-subtitle">Atualmente com {profile.degrees} Grau{profile.degrees !== 1 ? 's' : ''}</p>
              </div>
              {!isUnder15 && !isBlackBelt && (
                <div className="belt-badge">
                  <span className={`belt-color belt-${rule.nextBelt.toLowerCase().replace(/ /g, '-')}`}></span>
                  <span className="belt-next-label">Próxima</span>
                </div>
              )}
            </div>

            <div className="progress-bar-container">
              <div className="progress-bar-track">
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%` }}></div>
              </div>
              <div className="progress-labels">
                <span>{profile.attended_classes} Aulas</span>
                {isBlackBelt ? (
                  <span>🥋 Faixa Preta</span>
                ) : isUnder15 ? (
                  <span>Próxima Faixa</span>
                ) : (
                  <span>{rule.totalForNextBelt} Aulas para Faixa {rule.nextBelt}</span>
                )}
              </div>
            </div>

            {isBlackBelt ? (
              <div className="next-milestone">
                <p>🥋 És Faixa Preta! Total de presenças: <strong>{profile.attended_classes}</strong></p>
              </div>
            ) : (
              <div className="next-milestone">
                {isUnder15 ? (
                  <p>Faltam <strong>{classesUntilNextBelt}</strong> aulas para a próxima faixa.</p>
                ) : (
                  <>
                    <p>Faltam <strong>{classesUntilNextDegree}</strong> aulas para o próximo grau.</p>
                    <p>Faltam <strong>{classesUntilNextBelt}</strong> aulas para a Faixa {rule.nextBelt}.</p>
                  </>
                )}
              </div>
            )}
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
                .belt-badge { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
                .belt-color { display: block; width: 60px; height: 12px; border-radius: 4px; background: #222; border: 1px solid #444; }
                .belt-next-label { font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
                .belt-branco { background: #fff; }
                .belt-azul { background: #2563eb; }
                .belt-roxa { background: #9333ea; }
                .belt-marrom { background: #78350f; }
                .belt-preto { background: #000; }
                .belt-próxima { background: linear-gradient(90deg, #10b981, #065f46); }

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

                .class-selection-popup { background: var(--bg-card); border: 1px solid var(--primary); padding: 1rem; border-radius: 0.75rem; box-shadow: 0 10px 25px rgba(0,0,0,0.3); }
                .class-selection-popup h4 { font-size: 0.875rem; color: white; margin-bottom: 0.75rem; text-align: center; }
                .class-selection-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .btn-class-option { background: rgba(16, 185, 129, 0.1); border: 1px solid var(--primary); color: var(--primary); padding: 0.5rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
                .btn-class-option:hover { background: var(--primary); color: white; }
                .btn-cancel-selection { background: transparent; border: none; color: var(--text-muted); font-size: 0.7rem; cursor: pointer; padding-top: 0.25rem; }
                .btn-cancel-selection:hover { color: var(--danger); text-decoration: underline; }
                .text-secondary { color: #fb923c !important; }

                /* GPS Help Card */
                .gps-help-card {
                  background: rgba(239, 68, 68, 0.08);
                  border: 1px solid rgba(239, 68, 68, 0.3);
                  border-radius: 0.75rem;
                  padding: 1.25rem;
                  margin-top: 0.75rem;
                  display: flex;
                  flex-direction: column;
                  gap: 0.75rem;
                  max-width: 360px;
                }
                .gps-help-icon { font-size: 1.75rem; text-align: center; }
                .gps-help-card h4 { color: white; font-weight: 700; margin: 0; text-align: center; font-size: 0.95rem; }
                .gps-help-card > p { color: var(--text-muted); font-size: 0.78rem; text-align: center; }
                .gps-help-steps { display: flex; flex-direction: column; gap: 0.6rem; }
                .gps-step { display: flex; gap: 0.75rem; align-items: flex-start; background: rgba(255,255,255,0.04); padding: 0.6rem; border-radius: 0.5rem; }
                .gps-step-icon { font-size: 1.25rem; flex-shrink: 0; margin-top: 0.1rem; }
                .gps-step strong { color: white; font-size: 0.8rem; display: block; }
                .gps-step p { color: var(--text-muted); font-size: 0.72rem; margin: 0.2rem 0 0; }
                .btn-gps-reload { background: var(--primary); color: white; border: none; padding: 0.6rem; border-radius: 0.5rem; font-weight: 600; font-size: 0.8rem; cursor: pointer; transition: background 0.2s; width: 100%; }
                .btn-gps-reload:hover { background: var(--primary-dark); }

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
