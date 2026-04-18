import { useEffect, useState, useCallback } from 'react';
import { useOutletContext, Link } from 'react-router-dom';
import { Activity, Calendar, Clock, ExternalLink, Download, Edit2, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isProfessor } from '../lib/roles';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

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
  const [absentAthletes, setAbsentAthletes] = useState<any[]>([]);
  const [absentFilterDays, setAbsentFilterDays] = useState<number>(30);
  const [daysSinceLastTraining, setDaysSinceLastTraining] = useState<number | null>(null);
  const [monthlyAttended, setMonthlyAttended] = useState<number>(0);
  const [monthlyGoal, setMonthlyGoal] = useState<number | null>(null);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState('');
  const [adminFilterSchool, setAdminFilterSchool] = useState<string>('all');
  const [schools, setSchools] = useState<any[]>([]);
  const [totalAbsences, setTotalAbsences] = useState<number>(0);
  const [nextEvent, setNextEvent] = useState<any | null>(null);
  const [nextExternalEvents, setNextExternalEvents] = useState<any[]>([]);
  const [weeklyRanking, setWeeklyRanking] = useState<{ full_name: string; role: string; belt: string; count: number }[]>([]);
  const [monthlyAwards, setMonthlyAwards] = useState<{ full_name: string; role: string; belt: string; count: number }[]>([]);
  const [medals, setMedals] = useState({ gold: 0, silver: 0, bronze: 0 });
  const [editingMedals, setEditingMedals] = useState(false);
  const [medalInputs, setMedalInputs] = useState({ gold: '0', silver: '0', bronze: '0' });

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const today = now.toISOString().split('T')[0];

    // --- Definir todas as queries (NÃO aguardar ainda) ---

    // 1. Aulas da semana (Geral)
    const qWeekClasses = supabase
      .from('class_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .gte('created_at', startOfWeek.toISOString());

    // 2. Próximas aulas marcadas
    const qNextClasses = supabase
      .from('class_bookings')
      .select(`id, status, classes (id, title, date, start_time, end_time, school:schools(name))`)
      .eq('user_id', profile.id)
      .eq('status', 'Marcado')
      .gte('classes.date', today)
      .order('classes(date)', { ascending: true })
      .limit(3);

    // Variáveis que receberão resultados
    let weekCount = 0;
    let bookings: any = [];
    let schoolsData: any = null;
    let attendanceData: any = null;
    let todayClassesData: any = null;
    let presentToday = 0;
    let athleteCount = 0;
    let absentData: any = null;
    let monthCountAthlete = 0;
    let monthCountProf = 0;
    let faltasCount = 0;
    let eventData: any = null;
    let rankData: any = null;
    let rankHistData: any = null;
    let awardsData: any = null;
    let awardsHistData: any = null;
    let lastPresence: any = null;
    let externalEventData: any[] = [];

    // --- Preparar promessas extras baseadas na Role ---
    const promises: Promise<void>[] = [
      (async () => {
        const res = await qWeekClasses;
        weekCount = res.count || 0;
      })(),
      (async () => {
        const res = await qNextClasses;
        bookings = res.data || [];
      })()
    ];

    if (profile.role !== 'Atleta') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      const sevenDaysAgoDate = sevenDaysAgo.toISOString().split('T')[0];

      // Buscar escolas se não existirem
      if (schools.length === 0) {
        promises.push(
          (async () => {
            const res = await supabase.from('schools').select('id, name').order('order_index').order('name');
            schoolsData = res.data;
          })()
        );
      }

      // Attendance
      let attendanceQuery = supabase
        .from('class_bookings')
        .select('classes!inner(date, school_id)')
        .eq('status', 'Presente')
        .gte('classes.date', sevenDaysAgoDate)
        .lte('classes.date', today);
      if (isProfessor(profile.role) && profile.school_id) {
        attendanceQuery = (attendanceQuery as any).eq('classes.school_id', profile.school_id);
      } else if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        attendanceQuery = (attendanceQuery as any).eq('classes.school_id', adminFilterSchool);
      }
      promises.push((async () => {
        const res = await attendanceQuery;
        attendanceData = res.data;
      })());

      // Today Classes
      let todayQuery = supabase
        .from('classes')
        .select('id, title, start_time, end_time, class_bookings(count)')
        .eq('date', today);
      if (isProfessor(profile.role) && profile.school_id) {
        todayQuery = todayQuery.eq('school_id', profile.school_id);
      } else if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        todayQuery = todayQuery.eq('school_id', adminFilterSchool);
      }
      promises.push((async () => {
        const res = await todayQuery.order('start_time', { ascending: true });
        todayClassesData = res.data;
      })());

      // Present Today
      let presentQuery = supabase
        .from('class_bookings')
        .select('classes!inner(date, school_id)', { count: 'exact', head: true })
        .eq('status', 'Presente')
        .eq('classes.date', today);
      if (isProfessor(profile.role) && profile.school_id) {
        presentQuery = (presentQuery as any).eq('classes.school_id', profile.school_id);
      } else if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        presentQuery = (presentQuery as any).eq('classes.school_id', adminFilterSchool);
      }
      promises.push((async () => {
        const res = await presentQuery;
        presentToday = res.count || 0;
      })());

      // Athlete Count
      let athleteQuery = supabase
        .from('profiles')
        .select('id')
        .eq('role', 'Atleta')
        .eq('is_archived', false);
        
      if (isProfessor(profile.role)) {
        athleteQuery = athleteQuery.eq('assigned_professor_id', profile.id);
      } else if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        athleteQuery = athleteQuery.eq('school_id', adminFilterSchool);
      }
      
      promises.push((async () => {
        const res = await athleteQuery;
        athleteCount = res.data?.length || 0;
      })());

      // Absent Athletes
      promises.push((async () => {
        const res = await supabase.rpc('get_absent_athletes', {
          p_days: absentFilterDays,
          p_requesting_user_id: profile.id,
          p_requesting_role: profile.role,
          p_requesting_school_id: profile.role === 'Admin' ? (adminFilterSchool === 'all' ? null : adminFilterSchool) : profile.school_id
        });
        absentData = res.data;
      })());
    }

    if (profile.role === 'Atleta') {
      promises.push((async () => {
        const res = await supabase.from('class_bookings').select('classes(date)')
          .eq('user_id', profile.id).eq('status', 'Presente').order('classes(date)', { ascending: false }).limit(1);
        lastPresence = res.data;
      })());
    }

    const isAthleteOrProf = profile.role === 'Atleta' || isProfessor(profile.role);
    if (isAthleteOrProf) {
      const now2 = new Date();
      const firstDayOfMonth = new Date(now2.getFullYear(), now2.getMonth(), 1).toISOString().split('T')[0];
      const lastDayOfMonth = new Date(now2.getFullYear(), now2.getMonth() + 1, 0).toISOString().split('T')[0];

      if (profile.role === 'Atleta') {
        promises.push((async () => {
          const res = await supabase.from('class_bookings').select('classes!inner(date)', { count: 'exact', head: true })
            .eq('user_id', profile.id).eq('status', 'Presente').gte('classes.date', firstDayOfMonth).lte('classes.date', lastDayOfMonth);
          monthCountAthlete = res.count || 0;
        })());
        promises.push((async () => {
          const res = await supabase.from('class_bookings').select('*', { count: 'exact', head: true })
            .eq('user_id', profile.id).eq('status', 'Falta');
          faltasCount = res.count || 0;
        })());
      } else {
         promises.push((async () => {
          const res = await supabase.from('class_bookings').select('classes!inner(date)', { count: 'exact', head: true })
            .eq('user_id', profile.id).eq('status', 'Presente').gte('classes.date', firstDayOfMonth).lte('classes.date', lastDayOfMonth);
          monthCountProf = res.count || 0;
        })());
      }
    }

    // Eventos
    let eventQuery = supabase.from('events').select('id, title, dates, school_id')
      .gte('dates', `["${today}"]`).order('dates', { ascending: true }).limit(1);
    if (profile.role !== 'Admin') eventQuery = eventQuery.or(`school_id.is.null,school_id.eq.${profile.school_id}`);
    promises.push((async () => {
      const res = await eventQuery.maybeSingle();
      eventData = res.data;
    })());

    // Eliminar eventos externos já expirados (data < hoje) — limpeza automática via RPC
    // Usa SECURITY DEFINER para funcionar com qualquer utilizador autenticado
    promises.push((async () => {
      await supabase.rpc('cleanup_expired_external_events');
    })());

    // Eventos Externos (para todos) — os 2 mais próximos
    promises.push((async () => {
      const { data } = await supabase.from('external_events')
        .select('*')
        .gte('event_date', today)
        .order('event_date', { ascending: true })
        .limit(2);
      externalEventData = data || [];
    })());

    // Ranking Semanal
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    
    let rankingQuery = supabase.from('class_bookings')
      .select('user_id, profiles!inner(full_name, role, belt, school_id, is_hidden), classes!inner(date, school_id)')
      .eq('status', 'Presente')
      .gte('classes.date', weekStart.toISOString().split('T')[0])
      .lte('classes.date', weekEnd.toISOString().split('T')[0])
      .eq('profiles.is_hidden', false);
      
    if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        rankingQuery = rankingQuery.eq('profiles.school_id', adminFilterSchool);
    } else if (profile.role !== 'Admin' && profile.school_id) {
        rankingQuery = rankingQuery.eq('profiles.school_id', profile.school_id);
    }
    promises.push((async () => {
      const res = await rankingQuery;
      rankData = res.data;
    })());

    // Histórico do ranking semanal (4 semanas anteriores → desempate)
    const rankHistEnd = new Date(weekStart);
    rankHistEnd.setDate(weekStart.getDate() - 1);
    const rankHistStart = new Date(rankHistEnd);
    rankHistStart.setDate(rankHistEnd.getDate() - 27);
    let rankingHistQuery = supabase.from('class_bookings')
      .select('user_id, profiles!inner(school_id, is_hidden), classes!inner(date, school_id)')
      .eq('status', 'Presente')
      .gte('classes.date', rankHistStart.toISOString().split('T')[0])
      .lte('classes.date', rankHistEnd.toISOString().split('T')[0])
      .eq('profiles.is_hidden', false);
    if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        rankingHistQuery = (rankingHistQuery as any).eq('profiles.school_id', adminFilterSchool);
    } else if (profile.role !== 'Admin' && profile.school_id) {
        rankingHistQuery = (rankingHistQuery as any).eq('profiles.school_id', profile.school_id);
    }
    promises.push((async () => {
      const res = await rankingHistQuery;
      rankHistData = res.data;
    })());

    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthStart = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth() + 1, 0).toISOString().split('T')[0];

    // Premiação Mensal
    let awardsQuery = supabase.from('class_bookings')
      .select('user_id, profiles!inner(full_name, role, belt, school_id, is_hidden), classes!inner(date, school_id)')
      .eq('status', 'Presente')
      .gte('classes.date', prevMonthStart)
      .lte('classes.date', prevMonthEnd)
      .eq('profiles.is_hidden', false);

    if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        awardsQuery = awardsQuery.eq('profiles.school_id', adminFilterSchool);
    } else if (profile.role !== 'Admin' && profile.school_id) {
        awardsQuery = awardsQuery.eq('profiles.school_id', profile.school_id);
    }
    promises.push((async () => {
      const res = await awardsQuery;
      awardsData = res.data;
    })());

    // Histórico de premiação (3 meses anteriores → desempate)
    const awardsHistEndDate = new Date(prevMonthDate.getFullYear(), prevMonthDate.getMonth(), 0); // último dia do mês anterior a prevMonth
    const awardsHistStartDate = new Date(awardsHistEndDate.getFullYear(), awardsHistEndDate.getMonth() - 2, 1);
    let awardsHistQuery = supabase.from('class_bookings')
      .select('user_id, profiles!inner(school_id, is_hidden), classes!inner(date, school_id)')
      .eq('status', 'Presente')
      .gte('classes.date', awardsHistStartDate.toISOString().split('T')[0])
      .lte('classes.date', awardsHistEndDate.toISOString().split('T')[0])
      .eq('profiles.is_hidden', false);
    if (profile.role === 'Admin' && adminFilterSchool !== 'all') {
        awardsHistQuery = (awardsHistQuery as any).eq('profiles.school_id', adminFilterSchool);
    } else if (profile.role !== 'Admin' && profile.school_id) {
        awardsHistQuery = (awardsHistQuery as any).eq('profiles.school_id', profile.school_id);
    }
    promises.push((async () => {
      const res = await awardsHistQuery;
      awardsHistData = res.data;
    })());

    // --- AGUARDAR TODAS AS QUERIES EM PARALELO ---
    await Promise.all(promises);

    // --- Processar resultados de forma síncrona ---
    
    if (schoolsData) setSchools(schoolsData);

    setStats(prev => ({
      ...prev,
      weekClasses: weekCount,
      nextClasses: bookings?.map((b: any) => ({ ...b.classes, booking_id: b.id })).filter(Boolean) || []
    }));

    if (profile.role !== 'Atleta') {
       if (absentData) {
         setAbsentAthletes(
           (absentData || [])
             .filter((a: { is_hidden?: boolean }) => !a.is_hidden)
             .sort((a: any, b: any) => b.days_absent - a.days_absent)
         );
       }
       
       let weeklyAttendance: { day: string; count: number }[] = [];
       if (attendanceData) {
        const counts: Record<string, number> = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(now.getDate() - i);
          counts[d.toISOString().split('T')[0]] = 0;
        }
        attendanceData.forEach((b: any) => {
          const dateKey = b.classes?.date;
          if (dateKey && dateKey in counts) counts[dateKey]++;
        });
        weeklyAttendance = Object.entries(counts).map(([dateKey, count]) => ({
          day: new Date(dateKey + 'T12:00:00').toLocaleDateString('pt-PT', { weekday: 'short' }),
          count
        }));
      }
      setStats(prev => ({
          ...prev,
          weeklyAttendance: weeklyAttendance.length > 0 ? weeklyAttendance : prev.weeklyAttendance,
          totalAthletes: athleteCount,
          todayClasses: todayClassesData || [],
          totalPresent: presentToday
        }));
    }

    if (profile.role === 'Atleta') {
      if (lastPresence && lastPresence.length > 0) {
        const lastDate = new Date((lastPresence[0] as any).classes?.date + 'T12:00:00');
        const todayZero = new Date();
        todayZero.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((todayZero.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
        setDaysSinceLastTraining(diffDays);
      } else setDaysSinceLastTraining(-1);
    }

    if (isAthleteOrProf) {
       if (profile.role === 'Atleta') {
         setMonthlyAttended(monthCountAthlete);
         setTotalAbsences(faltasCount);
       } else {
         setMonthlyAttended(monthCountProf);
       }
       setMonthlyGoal(profile.monthly_goal ?? null);
       setGoalInput(profile.monthly_goal ? String(profile.monthly_goal) : '');
    }

    setNextEvent(eventData || null);
    setNextExternalEvents(externalEventData || []);

    if (rankData) {
      const counts: Record<string, { full_name: string; role: string; belt: string; count: number; tiebreaker: number }> = {};
      rankData.forEach((r: any) => {
        const uid = r.user_id;
        if (!counts[uid]) counts[uid] = { full_name: r.profiles.full_name, role: r.profiles.role, belt: r.profiles.belt, count: 0, tiebreaker: 0 };
        counts[uid].count++;
      });
      // Calcular tiebreaker com histórico das 4 semanas anteriores
      if (rankHistData) {
        rankHistData.forEach((r: any) => {
          if (counts[r.user_id]) counts[r.user_id].tiebreaker++;
        });
      }
      setWeeklyRanking(
        Object.values(counts)
          .sort((a, b) => b.count !== a.count ? b.count - a.count : b.tiebreaker - a.tiebreaker)
          .slice(0, 10)
      );
    } else setWeeklyRanking([]);

    if (awardsData) {
      const awardCounts: Record<string, { full_name: string; role: string; belt: string; count: number; tiebreaker: number }> = {};
      awardsData.forEach((r: any) => {
        const uid = r.user_id;
        if (!awardCounts[uid]) awardCounts[uid] = { full_name: r.profiles.full_name, role: r.profiles.role, belt: r.profiles.belt, count: 0, tiebreaker: 0 };
        awardCounts[uid].count++;
      });
      // Calcular tiebreaker com histórico dos 3 meses anteriores
      if (awardsHistData) {
        awardsHistData.forEach((r: any) => {
          if (awardCounts[r.user_id]) awardCounts[r.user_id].tiebreaker++;
        });
      }
      setMonthlyAwards(
        Object.values(awardCounts)
          .sort((a, b) => b.count !== a.count ? b.count - a.count : b.tiebreaker - a.tiebreaker)
          .slice(0, 5)
      );
    } else setMonthlyAwards([]);

    setLoading(false);
  }, [profile, absentFilterDays, adminFilterSchool, schools.length]);

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
      setMedals({
        gold: profile.medals_gold || 0,
        silver: profile.medals_silver || 0,
        bronze: profile.medals_bronze || 0
      });
      setMedalInputs({
        gold: String(profile.medals_gold || 0),
        silver: String(profile.medals_silver || 0),
        bronze: String(profile.medals_bronze || 0)
      });
    }
  }, [profile, absentFilterDays, adminFilterSchool, fetchDashboardData]);

  const exportInactivePDF = () => {
    if (absentAthletes.length === 0) {
      alert('Não há atletas inativos para exportar.');
      return;
    }

    const doc = new jsPDF();
    doc.text(`Relatório de Retenção (Inativos) - ${new Date().toLocaleDateString('pt-PT')}`, 14, 15);

    const tableColumn = ["Nome", "Cinto", "Escola", "Dias sem treinar"];
    const tableRows = absentAthletes.map((a: any) => [
      a.full_name,
      a.belt,
      a.school_name || 'N/A',
      a.days_absent
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    const filename = `Retencao_Inativos_${absentFilterDays}_dias_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  };

  const exportHistoryPDF = async () => {
    setLoading(true);
    const { data: history } = await supabase
      .from('class_bookings')
      .select(`
        status,
        created_at,
        classes (title, date, start_time)
      `)
      .eq('user_id', profile.id)
      .in('status', ['Presente', 'Falta'])
      .order('created_at', { ascending: false });

    if (!history || history.length === 0) {
      alert('Não tens histórico de presenças para exportar.');
      setLoading(false);
      return;
    }

    const doc = new jsPDF();
    doc.text(`Histórico de Presenças - ${profile.full_name}`, 14, 15);

    const tableColumn = ["Data", "Aula", "Hora", "Status"];
    const tableRows = history.map((h: any) => [
      new Date(h.classes.date).toLocaleDateString('pt-PT'),
      h.classes.title,
      h.classes.start_time.substring(0, 5),
      h.status
    ]);

    autoTable(doc, {
      head: [tableColumn],
      body: tableRows,
      startY: 20,
    });

    doc.save(`ZRTeam_Historico_${profile.full_name.replace(/ /g, '_')}.pdf`);
    setLoading(false);
  };

  const exportHistoryExcel = async () => {
    setLoading(true);
    const { data: history } = await supabase
      .from('class_bookings')
      .select(`
        status,
        created_at,
        classes (title, date, start_time)
      `)
      .eq('user_id', profile.id)
      .in('status', ['Presente', 'Falta'])
      .order('created_at', { ascending: false });

    if (!history || history.length === 0) {
      alert('Não tens histórico de presenças para exportar.');
      setLoading(false);
      return;
    }

    const excelData = history.map((h: any) => ({
      'Data': new Date(h.classes.date).toLocaleDateString('pt-PT'),
      'Aula': h.classes.title,
      'Hora': h.classes.start_time.substring(0, 5),
      'Status': h.status
    }));

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Presenças");
    XLSX.writeFile(workbook, `ZRTeam_Historico_${profile.full_name.replace(/ /g, '_')}.xlsx`);
    setLoading(false);
  };

  const handleSaveGoal = async () => {
    const val = parseInt(goalInput, 10);
    if (isNaN(val) || val < 1 || val > 365) return;
    const { error } = await supabase
      .from('profiles')
      .update({ monthly_goal: val })
      .eq('id', profile.id);
    if (!error) {
      setMonthlyGoal(val);
      setEditingGoal(false);
    }
  };

  const handleClearGoal = async () => {
    await supabase.from('profiles').update({ monthly_goal: null }).eq('id', profile.id);
    setMonthlyGoal(null);
    setGoalInput('');
    setEditingGoal(false);
  };

  const handleSaveMedals = async () => {
    const gold = parseInt(medalInputs.gold, 10) || 0;
    const silver = parseInt(medalInputs.silver, 10) || 0;
    const bronze = parseInt(medalInputs.bronze, 10) || 0;

    const { error } = await supabase
      .from('profiles')
      .update({
        medals_gold: gold,
        medals_silver: silver,
        medals_bronze: bronze
      })
      .eq('id', profile.id);

    if (!error) {
      setMedals({ gold, silver, bronze });
      setEditingMedals(false);
    }
  };

  if (!profile) return null;

  // Faixa preta: sem próxima faixa
  const isBlackBelt = profile.belt === 'Preto';

  // Atleta menor de 15 anos (calculado pela data de nascimento)
  const isUnder15 = (() => {
    if (!profile.date_of_birth) return false;
    const birth = new Date(profile.date_of_birth);
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

  if (profile.role === 'Admin' || isProfessor(profile.role)) {
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
            <span className="school-pill">{profile.school?.name || 'ZR Team'}</span>
            {profile.role === 'Admin' && schools.length > 0 && (
              <select
                value={adminFilterSchool}
                onChange={e => setAdminFilterSchool(e.target.value)}
                style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: '0.5rem', padding: '0.3rem 0.65rem',
                  color: adminFilterSchool !== 'all' ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: '0.78rem', cursor: 'pointer', outline: 'none'
                }}
              >
                <option value="all">🏫 Todas as Escolas</option>
                {schools.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
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

        {/* Card: Quadro de Medalhas (Pessoal para Professor/Admin) */}
        {!loading && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                🏆 O Meu Quadro de Medalhas
              </span>
              <button
                onClick={() => {
                  if (editingMedals) {
                    handleSaveMedals();
                  } else {
                    setEditingMedals(true);
                  }
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}
              >
                {editingMedals ? <span style={{ color: 'var(--primary)', fontWeight: 700 }}>Guardar</span> : <><Edit2 size={13} /> Editar</>}
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🥇</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Ouro</div>
                {editingMedals ? (
                  <input
                    type="number" min="0" value={medalInputs.gold}
                    onChange={e => setMedalInputs(prev => ({ ...prev, gold: e.target.value }))}
                    style={{ width: '100%', textAlign: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'white', borderRadius: '0.3rem', fontSize: '1rem', fontWeight: 800 }}
                  />
                ) : (
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f59e0b' }}>{medals.gold}</div>
                )}
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(156,163,175,0.05)', border: '1px solid rgba(156,163,175,0.1)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🥈</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Prata</div>
                {editingMedals ? (
                  <input
                    type="number" min="0" value={medalInputs.silver}
                    onChange={e => setMedalInputs(prev => ({ ...prev, silver: e.target.value }))}
                    style={{ width: '100%', textAlign: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'white', borderRadius: '0.3rem', fontSize: '1rem', fontWeight: 800 }}
                  />
                ) : (
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#9ca3af' }}>{medals.silver}</div>
                )}
              </div>
              <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '0.75rem', background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.1)' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🥉</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.25rem' }}>Bronze</div>
                {editingMedals ? (
                  <input
                    type="number" min="0" value={medalInputs.bronze}
                    onChange={e => setMedalInputs(prev => ({ ...prev, bronze: e.target.value }))}
                    style={{ width: '100%', textAlign: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'white', borderRadius: '0.3rem', fontSize: '1rem', fontWeight: 800 }}
                  />
                ) : (
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#b45309' }}>{medals.bronze}</div>
                )}
              </div>
            </div>
            {editingMedals && (
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <button onClick={handleSaveMedals} className="btn-primary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem' }}>Guardar Alterações</button>
                <button onClick={() => { setEditingMedals(false); setMedalInputs({ gold: String(medals.gold), silver: String(medals.silver), bronze: String(medals.bronze) }); }} className="btn-secondary" style={{ flex: 1, fontSize: '0.8rem', padding: '0.4rem' }}>Cancelar</button>
              </div>
            )}
          </div>
        )}

        {/* Próximos Eventos Externos (Admin/Prof) */}
        {!loading && nextExternalEvents.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {nextExternalEvents.map((extEv: any) => (
              <div
                key={extEv.id}
                onClick={() => extEv.link_url && window.open(extEv.link_url, '_blank')}
                style={{
                  background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
                  border: '1px solid rgba(16, 185, 129, 0.2)',
                  borderRadius: '1rem', padding: '1.25rem',
                  cursor: extEv.link_url ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => { if (extEv.link_url) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16,185,129,0.1)'; } }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  <div style={{
                    width: '56px', height: '56px', borderRadius: '1rem', background: 'var(--bg-dark)',
                    border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.75rem', flexShrink: 0
                  }}>
                    🏆
                  </div>
                  <div>
                    <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', color: 'white', fontWeight: 700 }}>
                      {extEv.name}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        📅 {new Date(extEv.event_date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                      </span>
                      {(() => {
                        const d = new Date(extEv.event_date + 'T12:00:00');
                        const t = new Date(); t.setHours(0,0,0,0);
                        const diff = Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
                        return diff === 0 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.15)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>Hoje!</span>
                          : diff === 1 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fcd34d', background: 'rgba(245,158,11,0.15)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>Amanhã</span>
                          : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(16,185,129,0.15)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>Daqui a {diff} dias</span>;
                      })()}
                    </div>
                  </div>
                </div>
                {extEv.link_url && <ExternalLink size={20} style={{ color: 'var(--primary)', opacity: 0.7 }} />}
              </div>
            ))}
          </div>
        )}

        <div className="admin-dashboard-grid">
          {/* Chart — barras horizontais */}
          <div className="admin-card admin-chart-card">
            <h3 className="admin-card-title">📈 Afluência (Últimos 7 dias)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {stats.weeklyAttendance.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span style={{ width: '2.8rem', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0, textTransform: 'capitalize' }}>{item.day}</span>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', height: '10px', overflow: 'hidden' }}>
                    <div style={{
                      width: `${maxAttendance > 0 ? Math.max(4, Math.round((item.count / maxAttendance) * 100)) : 0}%`,
                      height: '100%', borderRadius: '9999px',
                      background: item.count === 0 ? 'rgba(255,255,255,0.08)' : (item.count === maxAttendance ? 'linear-gradient(90deg, var(--primary), #34d399)' : 'rgba(16,185,129,0.5)'),
                      transition: 'width 0.5s ease'
                    }} />
                  </div>
                  <span style={{ width: '1.4rem', textAlign: 'right', fontSize: '0.82rem', fontWeight: 600, color: item.count === 0 ? 'var(--text-muted)' : 'white', flexShrink: 0 }}>{item.count}</span>
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

          {/* Ranking Semanal */}
          <div className="admin-card ranking-card">
            <h3 className="admin-card-title">🏅 Ranking Semanal da Escola</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '-0.5rem' }}>
              Top 10 presenças de seg a dom desta semana
            </p>
            {weeklyRanking.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ainda sem presenças esta semana.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {weeklyRanking.map((r, idx) => {
                  const maxCount = weeklyRanking[0].count;
                  const pct = maxCount > 0 ? Math.max(6, Math.round((r.count / maxCount) * 100)) : 0;
                  const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                  return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ width: '1.8rem', textAlign: 'center', fontSize: idx < 3 ? '1rem' : '0.75rem', color: idx < 3 ? 'white' : 'var(--text-muted)', flexShrink: 0 }}>{medal}</span>
                      <span style={{ width: '7rem', fontSize: '0.78rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.full_name}</span>
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                        <div style={{ width: `${pct}%`, height: '100%', borderRadius: '9999px', background: idx === 0 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : idx === 1 ? 'linear-gradient(90deg, #9ca3af, #d1d5db)' : idx === 2 ? 'linear-gradient(90deg, #b45309, #d97706)' : 'linear-gradient(90deg, var(--primary), #34d399)', transition: 'width 0.5s ease' }} />
                      </div>
                      <span style={{ width: '1.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: idx === 0 ? '#fbbf24' : 'white', flexShrink: 0 }}>{r.count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Premiação Mensal */}
          {monthlyAwards.length > 0 && (() => {
            const prevMonthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
              .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
            const stars = ['⭐⭐⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐', '⭐⭐', '⭐'];
            const starLabels = ['1º lugar', '2º lugar', '3º lugar', '4º lugar', '5º lugar'];
            return (
              <div className="admin-card">
                <h3 className="admin-card-title">🏆 Premiação — {prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1)}</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '-0.5rem' }}>Mais presenças do mês anterior</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {monthlyAwards.map((a, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: idx === 0 ? 'rgba(245,158,11,0.1)' : idx === 1 ? 'rgba(156,163,175,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${idx === 0 ? 'rgba(245,158,11,0.3)' : idx === 1 ? 'rgba(156,163,175,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                      <div style={{ textAlign: 'center', minWidth: '3.5rem' }}>
                        <div style={{ fontSize: '0.9rem', lineHeight: 1 }}>{stars[idx]}</div>
                        <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{starLabels[idx]}</div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{a.full_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.role} • {a.belt}</div>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1.1rem', color: idx === 0 ? '#fbbf24' : 'var(--text-muted)' }}>{a.count} 🥋</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Retenção de Alunos (Inativos) */}
          <div className="admin-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 className="admin-card-title" style={{ margin: 0 }}>⚠️ Retenção (Inativos)</h3>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <button 
                  onClick={exportInactivePDF} 
                  className="btn-export-mini" 
                  title="Exportar inativos para PDF"
                  style={{ padding: '0.2rem 0.5rem' }}
                >
                  <Download size={14} />
                  <span style={{ fontSize: '0.7rem', marginLeft: '0.3rem', fontWeight: 600 }}>PDF</span>
                </button>
                <select
                  value={absentFilterDays}
                  onChange={(e) => setAbsentFilterDays(Number(e.target.value))}
                  style={{ background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'var(--text-main)', padding: '0.3rem 0.5rem', borderRadius: '0.5rem', fontSize: '0.75rem', outline: 'none' }}
                >
                  <option value={7}>{'> 1 Semana'}</option>
                  <option value={30}>{'> 1 Mês'}</option>
                </select>
              </div>
            </div>
            {absentAthletes.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', paddingTop: '0.5rem' }}>Todos os atletas treinaram recentemente. Excelente!</p>
            ) : (
              <div className="absent-athletes-list" style={{ maxHeight: '250px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                {absentAthletes.map((athlete: any) => (
                  <div key={athlete.athlete_id} className="today-class-row" style={{ padding: '0.75rem 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div className="today-class-info">
                      <span className="today-class-title" style={{ fontSize: '0.9rem' }}>{athlete.full_name}</span>
                      <span className="today-class-time" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.25rem', fontSize: '0.75rem' }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: athlete.belt === 'Branco' ? '#fff' : athlete.belt === 'Azul' ? '#2563eb' : athlete.belt === 'Roxo' ? '#9333ea' : athlete.belt === 'Marrom' ? '#92400e' : athlete.belt === 'Preto' ? '#111827' : '#9ca3af', border: athlete.belt === 'Branco' ? '1px solid #555' : 'none', flexShrink: 0 }}></div>
                        {athlete.user_role && athlete.user_role !== 'Atleta' && <span style={{ background: 'rgba(255,255,255,0.1)', padding: '0.1rem 0.3rem', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.2)' }}>{athlete.user_role}</span>}
                        {athlete.belt} {profile.role === 'Admin' && <span style={{ opacity: 0.5 }}>• {athlete.school_name || 'Sem escola'}</span>}
                      </span>
                    </div>
                    <span className="today-class-pill" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)', padding: '0.25rem 0.5rem' }}>
                      {athlete.days_absent} dias
                    </span>
                  </div>
                ))}
              </div>
            )}
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

          .export-buttons-mini { display: flex; gap: 0.5rem; }
          .btn-export-mini { 
            background: rgba(255,255,255,0.05); border: 1px solid var(--border); 
            color: var(--text-muted); cursor: pointer; padding: 0.25rem; 
            border-radius: 0.4rem; display: flex; align-items: center; justify-content: center;
            transition: all 0.2s;
          }
          .btn-export-mini:hover { background: rgba(16,185,129,0.1); color: var(--primary); border-color: var(--primary); }
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <h3>Total de Presenças</h3>
              <div className="export-buttons-mini">
                <button onClick={exportHistoryExcel} className="btn-export-mini" title="Exportar Excel">
                  <Download size={14} />
                </button>
                <button onClick={exportHistoryPDF} className="btn-export-mini" title="Exportar PDF">
                  <Download size={14} />
                </button>
              </div>
            </div>
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
        {(profile.role === 'Atleta' || isProfessor(profile.role)) && (
            <div className="stat-card" style={{ borderLeft: '4px solid #ef4444' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '1rem', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <span style={{ fontSize: '1.5rem' }}>⚠️</span>
              </div>
              <div className="stat-content" style={{ marginLeft: '1rem' }}>
                <h3>Faltas Acumuladas</h3>
                <p className="stat-value">{totalAbsences}</p>
                <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    {totalAbsences > 0 ? `Falta(m) ${3 - (totalAbsences % 3)} para penalização` : 'A Cada 3 = -1 Presença'}
                </p>
              </div>
            </div>
        )}
      </div>

      {/* Card: Objetivo Mensal (Atletas e Professores) */}
      {(profile.role === 'Atleta' || isProfessor(profile.role)) && !loading && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Target size={16} style={{ color: 'var(--primary)' }} /> Objetivo Mensal
            </span>
            {monthlyGoal !== null && !editingGoal && (
              <button onClick={() => { setEditingGoal(true); setGoalInput(String(monthlyGoal)); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem' }}>
                <Edit2 size={13} /> Alterar
              </button>
            )}
          </div>

          {editingGoal ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="number" min="1" max="365"
                value={goalInput}
                onChange={e => setGoalInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSaveGoal()}
                placeholder="Ex: 12"
                style={{ width: '80px', padding: '0.35rem 0.6rem', borderRadius: '0.4rem', border: '1px solid var(--border)', background: 'var(--bg-dark)', color: 'white', fontSize: '0.9rem', outline: 'none' }}
                autoFocus
              />
              <button onClick={handleSaveGoal} className="btn-primary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>Guardar</button>
              <button onClick={() => setEditingGoal(false)} className="btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}>Cancelar</button>
              {monthlyGoal !== null && (
                <button onClick={handleClearGoal} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'underline' }}>Remover objetivo</button>
              )}
            </div>
          ) : monthlyGoal === null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>Ainda não definiste um objetivo mensal.</p>
              <button onClick={() => setEditingGoal(true)} className="btn-primary" style={{ padding: '0.3rem 0.9rem', fontSize: '0.8rem' }}>🎯 Definir Objetivo</button>
            </div>
          ) : (() => {
            const pct = Math.min(100, Math.round((monthlyAttended / monthlyGoal) * 100));
            const remaining = Math.max(0, monthlyGoal - monthlyAttended);
            const achieved = monthlyAttended >= monthlyGoal;
            return (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <span>{monthlyAttended} / {monthlyGoal} aulas este mês</span>
                  <span style={{ color: achieved ? '#10b981' : 'var(--text-muted)', fontWeight: 600 }}>{pct}%</span>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: '9999px', height: '8px', overflow: 'hidden', marginBottom: '0.5rem' }}>
                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: '9999px', background: achieved ? 'linear-gradient(90deg,#10b981,#34d399)' : 'linear-gradient(90deg,var(--primary),#34d399)', transition: 'width 0.6s ease' }} />
                </div>
                <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, color: achieved ? '#34d399' : 'var(--text-main)' }}>
                  {achieved
                    ? '🎉 Objetivo atingido! Parabéns!'
                    : `Faltam ${remaining} aula${remaining !== 1 ? 's' : ''} para o teu objetivo mensal! 💪`}
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {/* Card: Quadro de Medalhas (Pessoal) */}
      {!loading && (
        <div style={{
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: '0.75rem', padding: '1rem 1.25rem', marginBottom: '1rem'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              🏆 O Meu Quadro de Medalhas
            </span>
            <button
              onClick={() => {
                if (editingMedals) {
                  handleSaveMedals();
                } else {
                  setEditingMedals(true);
                  setMedalInputs({
                    gold: String(medals.gold),
                    silver: String(medals.silver),
                    bronze: String(medals.bronze)
                  });
                }
              }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.75rem', fontWeight: 600 }}
            >
              {editingMedals ? (
                <>✔️ Guardar</>
              ) : (
                <><Edit2 size={13} /> Editar Medalhas</>
              )}
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
            <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.1)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🥇</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Ouro</div>
              {editingMedals ? (
                <input
                  type="number" min="0"
                  value={medalInputs.gold}
                  onChange={e => setMedalInputs(prev => ({ ...prev, gold: e.target.value }))}
                  style={{ width: '100%', textAlign: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '0.4rem', color: 'white', padding: '0.2rem' }}
                />
              ) : (
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fbbf24' }}>{medals.gold}</div>
              )}
            </div>

            <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(156,163,175,0.05)', border: '1px solid rgba(156,163,175,0.1)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🥈</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Prata</div>
              {editingMedals ? (
                <input
                  type="number" min="0"
                  value={medalInputs.silver}
                  onChange={e => setMedalInputs(prev => ({ ...prev, silver: e.target.value }))}
                  style={{ width: '100%', textAlign: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '0.4rem', color: 'white', padding: '0.2rem' }}
                />
              ) : (
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d1d5db' }}>{medals.silver}</div>
              )}
            </div>

            <div style={{ textAlign: 'center', padding: '0.75rem', borderRadius: '0.5rem', background: 'rgba(180,83,9,0.05)', border: '1px solid rgba(180,83,9,0.1)' }}>
              <div style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>🥉</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700, marginBottom: '0.5rem' }}>Bronze</div>
              {editingMedals ? (
                <input
                  type="number" min="0"
                  value={medalInputs.bronze}
                  onChange={e => setMedalInputs(prev => ({ ...prev, bronze: e.target.value }))}
                  style={{ width: '100%', textAlign: 'center', background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '0.4rem', color: 'white', padding: '0.2rem' }}
                />
              ) : (
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#d97706' }}>{medals.bronze}</div>
              )}
            </div>
          </div>
          {editingMedals && (
            <button 
              onClick={() => setEditingMedals(false)}
              style={{ display: 'block', margin: '1rem auto 0', background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Cancelar
            </button>
          )}
        </div>
      )}

      {/* Próximos Eventos Externos (Atleta) */}
      {!loading && profile.role === 'Atleta' && nextExternalEvents.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.5rem' }}>
          {nextExternalEvents.map((extEv: any) => (
            <div
              key={extEv.id}
              onClick={() => extEv.link_url && window.open(extEv.link_url, '_blank')}
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(5, 150, 105, 0.05) 100%)',
                border: '1px solid rgba(16, 185, 129, 0.2)',
                borderRadius: '1rem', padding: '1.25rem',
                cursor: extEv.link_url ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { if (extEv.link_url) { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 10px 25px -5px rgba(16,185,129,0.1)'; } }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                <div style={{
                  width: '56px', height: '56px', borderRadius: '1rem', background: 'var(--bg-dark)',
                  border: '1px solid rgba(16, 185, 129, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.75rem', flexShrink: 0
                }}>
                  🏆
                </div>
                <div>
                  <h3 style={{ margin: '0 0 0.2rem', fontSize: '1.05rem', color: 'white', fontWeight: 700 }}>
                    {extEv.name}
                  </h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      📅 {new Date(extEv.event_date + 'T12:00:00').toLocaleDateString('pt-PT', { day: 'numeric', month: 'long' })}
                    </span>
                    {(() => {
                      const d = new Date(extEv.event_date + 'T12:00:00');
                      const t = new Date(); t.setHours(0,0,0,0);
                      const diff = Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
                      return diff === 0 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fca5a5', background: 'rgba(239,68,68,0.15)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>Hoje!</span>
                        : diff === 1 ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#fcd34d', background: 'rgba(245,158,11,0.15)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>Amanhã</span>
                        : <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', background: 'rgba(16,185,129,0.15)', padding: '0.15rem 0.5rem', borderRadius: '9999px' }}>Daqui a {diff} dias</span>;
                    })()}
                  </div>
                </div>
              </div>
              {extEv.link_url && <ExternalLink size={20} style={{ color: 'var(--primary)', opacity: 0.7 }} />}
            </div>
          ))}
        </div>
      )}

      {/* Ranking Semanal da Escola (todos os utilizadores) */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
        <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700 }}>🏅 Ranking Semanal da Escola</h3>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '0.1rem' }}>Top 10 presenças de seg a dom desta semana</p>
        {weeklyRanking.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Ainda sem presenças esta semana.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {weeklyRanking.map((r, idx) => {
              const maxCount = weeklyRanking[0].count;
              const pct = maxCount > 0 ? Math.max(6, Math.round((r.count / maxCount) * 100)) : 0;
              const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
              return (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span style={{ width: '1.8rem', textAlign: 'center', fontSize: idx < 3 ? '1rem' : '0.75rem', color: idx < 3 ? 'white' : 'var(--text-muted)', flexShrink: 0 }}>{medal}</span>
                  <span style={{ width: '7rem', fontSize: '0.78rem', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flexShrink: 0 }}>{r.full_name}</span>
                  <div style={{ flex: 1, background: 'rgba(255,255,255,0.06)', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', borderRadius: '9999px', background: idx === 0 ? 'linear-gradient(90deg, #f59e0b, #fbbf24)' : idx === 1 ? 'linear-gradient(90deg, #9ca3af, #d1d5db)' : idx === 2 ? 'linear-gradient(90deg, #b45309, #d97706)' : 'linear-gradient(90deg, var(--primary), #34d399)', transition: 'width 0.5s ease' }} />
                  </div>
                  <span style={{ width: '1.5rem', textAlign: 'right', fontSize: '0.8rem', fontWeight: 700, color: idx === 0 ? '#fbbf24' : 'white', flexShrink: 0 }}>{r.count}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Premiação Mensal (todos os utilizadores) */}
      {monthlyAwards.length > 0 && (() => {
        const prevMonthName = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
          .toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
        const stars = ['⭐⭐⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐', '⭐⭐', '⭐'];
        const starLabels = ['1º lugar', '2º lugar', '3º lugar', '4º lugar', '5º lugar'];
        return (
          <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '1rem', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 700 }}>🏆 Premiação — {prevMonthName.charAt(0).toUpperCase() + prevMonthName.slice(1)}</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: '0.1rem' }}>Mais presenças do mês anterior</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {monthlyAwards.map((a, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: '0.5rem', background: idx === 0 ? 'rgba(245,158,11,0.1)' : idx === 1 ? 'rgba(156,163,175,0.08)' : 'rgba(255,255,255,0.04)', border: `1px solid ${idx === 0 ? 'rgba(245,158,11,0.3)' : idx === 1 ? 'rgba(156,163,175,0.2)' : 'rgba(255,255,255,0.06)'}` }}>
                  <div style={{ textAlign: 'center', minWidth: '3.5rem' }}>
                    <div style={{ fontSize: '0.9rem', lineHeight: 1 }}>{stars[idx]}</div>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>{starLabels[idx]}</div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'white' }}>{a.full_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{a.role} • {a.belt}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '1.1rem', color: idx === 0 ? '#fbbf24' : 'var(--text-muted)' }}>{a.count} 🥋</div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Contador de dias sem treinar */}
      {!loading && profile.role === 'Atleta' && daysSinceLastTraining !== null && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '1rem',
          padding: '0.9rem 1.25rem',
          borderRadius: '0.75rem',
          marginBottom: '1.25rem',
          border: '1px solid',
          ...(daysSinceLastTraining === -1
            ? { background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', color: '#93c5fd' }
            : daysSinceLastTraining === 0
            ? { background: 'rgba(16,185,129,0.1)', borderColor: 'rgba(16,185,129,0.3)', color: '#6ee7b7' }
            : daysSinceLastTraining <= 7
            ? { background: 'rgba(245,158,11,0.1)', borderColor: 'rgba(245,158,11,0.3)', color: '#fcd34d' }
            : { background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#fca5a5' })
        }}>
          <span style={{ fontSize: '1.5rem' }}>
            {daysSinceLastTraining === -1 ? '🔵'
              : daysSinceLastTraining === 0 ? '🎉'
              : daysSinceLastTraining <= 7 ? '🟠'
              : '🔴'}
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>
            {daysSinceLastTraining === -1
              ? 'Ainda não tens presenças registadas.'
              : daysSinceLastTraining === 0
              ? 'Treino de hoje já foi contabilizado! Excelente! 🥋'
              : daysSinceLastTraining === 1
              ? '1 dia sem treinar.'
              : `${daysSinceLastTraining} dias sem treinar${daysSinceLastTraining > 7 ? ' — Volta ao tatame!' : '.'}`}
          </span>
        </div>
      )}

      <div className="dashboard-grid">
        <div className="progression-column">
          {/* Próximo Evento (se houver) */}
          {nextEvent && (
            <div className="progression-card next-event-card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
              <div className="progression-header">
                <div>
                  <h3 style={{ margin: 0, fontSize: '1rem', color: '#9ca3af', fontWeight: 600 }}>Próximo Evento</h3>
                  <h4 style={{ margin: '0.2rem 0 0', fontSize: '1.25rem', color: 'white', fontWeight: 700 }}>{nextEvent.title}</h4>
                </div>
                <span style={{ fontSize: '1.75rem' }}>📅</span>
              </div>
              <div style={{ marginTop: '1rem' }}>
                <div style={{ fontSize: '1.1rem', color: '#60a5fa', marginBottom: '1rem' }}>
                  {(() => {
                    const eventDate = new Date(nextEvent.dates[0]);
                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const diffTime = eventDate.getTime() - today.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === 0) return <strong>É hoje!</strong>;
                    if (diffDays === 1) return <strong>Amanhã</strong>;
                    return <span>Faltam <strong>{diffDays}</strong> dias</span>;
                  })()}
                </div>
                <Link to="/eventos" className="btn-primary" style={{ padding: '0.5rem 1rem', fontSize: '0.875rem' }}>
                  Ver Eventos
                </Link>
              </div>
            </div>
          )}

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
                        {cls.school?.name && (
                          <p style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            🏢 {cls.school.name}
                          </p>
                        )}
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
