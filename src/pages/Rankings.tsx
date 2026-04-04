import { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BarChart2, Download, Trophy, Medal, ChevronDown } from 'lucide-react';

const BELT_COLORS: Record<string, string> = {
  'Branco': '#e5e7eb',
  'Cinza/ branco': '#9ca3af',
  'Cinza': '#6b7280',
  'Cinza/ Preto': '#4b5563',
  'Amarelo / Branco': '#fef08a',
  'Amarelo': '#facc15',
  'Amarelo/ preto': '#ca8a04',
  'Laranja/ Branco': '#fed7aa',
  'Laranja': '#fb923c',
  'Laranja/ preto': '#ea580c',
  'Verde / Branco': '#bbf7d0',
  'Verde': '#22c55e',
  'Verde / Preto': '#16a34a',
  'Azul': '#3b82f6',
  'Roxo': '#a855f7',
  'Marrom': '#92400e',
  'Preto': '#1f2937',
  'Amarelo/preto': '#ca8a04',
  'Amarelo/ Preto': '#ca8a04',
};

interface RankEntry {
  user_id: string;
  full_name: string;
  belt: string;
  role: string;
  count: number;
  tiebreaker: number; // presenças no período histórico
}

type Mode = 'weekly' | 'monthly';
type WeekOffset = 0 | 1; // 0 = semana atual, 1 = semana anterior
type MonthOffset = 0 | 1; // 0 = mês atual, 1 = mês anterior

interface School {
  id: string;
  name: string;
}

interface BookingRow {
  user_id: string;
  profiles: {
    full_name: string;
    belt: string;
    role: string;
    school_id: string;
    is_hidden: boolean;
    is_archived: boolean;
  } | null;
  classes: { date: string; school_id: string } | null;
}

interface HistoryRow {
  user_id: string;
  profiles: { school_id: string; is_hidden: boolean; is_archived: boolean } | null;
  classes: { date: string; school_id: string } | null;
}

function getWeekRange(offset: WeekOffset) {
  const now = new Date();
  const dayOfWeek = now.getDay(); // 0=dom, 1=seg...
  const mondayOffset = (dayOfWeek + 6) % 7; // dias desde segunda
  const monday = new Date(now);
  monday.setDate(now.getDate() - mondayOffset - offset * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return {
    start: monday.toISOString().split('T')[0],
    end: sunday.toISOString().split('T')[0],
    label: offset === 0 ? 'Semana Atual' : 'Semana Anterior',
  };
}

function getMonthRange(offset: MonthOffset) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() - offset;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const monthName = firstDay.toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
  return {
    start: firstDay.toISOString().split('T')[0],
    end: lastDay.toISOString().split('T')[0],
    label: offset === 0 ? `Mês Atual — ${monthName}` : `Mês Anterior — ${monthName}`,
    monthName,
  };
}

function sortWithTiebreaker(a: RankEntry, b: RankEntry): number {
  if (b.count !== a.count) return b.count - a.count;
  return b.tiebreaker - a.tiebreaker;
}

export default function Rankings() {
  const { profile } = useOutletContext<{ profile: Record<string, unknown> & { role: string; school_id?: string; school?: { name?: string; head_professor_id?: string } } }>();

  const [mode, setMode] = useState<Mode>('weekly');
  const [weekOffset, setWeekOffset] = useState<WeekOffset>(0);
  const [monthOffset, setMonthOffset] = useState<MonthOffset>(0);
  const isAdmin = profile?.role === 'Admin';
  const isHeadProf = profile?.role === 'Professor Responsável';
  // Inicializar a escola correta diretamente (sem useEffect)
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>(
    isHeadProf && profile?.school_id ? (profile.school_id as string) : ''
  );
  const [schools, setSchools] = useState<School[]>([]);
  const [ranking, setRanking] = useState<RankEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Carregar escolas (apenas Admin)
  useEffect(() => {
    if (!isAdmin) return;
    supabase.from('schools').select('id, name').order('order_index').order('name').then(({ data }) => {
      if (data && data.length > 0) {
        setSchools(data as School[]);
        setSelectedSchoolId((prev) => prev || data[0].id);
      }
    });
  }, [isAdmin]);

  const fetchRanking = useCallback(async () => {
    if (!selectedSchoolId) return;
    setLoading(true);

    let periodStart: string;
    let periodEnd: string;
    let historyStart: string;
    let historyEnd: string;

    if (mode === 'weekly') {
      const week = getWeekRange(weekOffset);
      periodStart = week.start;
      periodEnd = week.end;
      // histórico: 4 semanas anteriores ao início do período
      const histStart = new Date(periodStart);
      histStart.setDate(histStart.getDate() - 28);
      const histEnd = new Date(periodStart);
      histEnd.setDate(histEnd.getDate() - 1);
      historyStart = histStart.toISOString().split('T')[0];
      historyEnd = histEnd.toISOString().split('T')[0];
    } else {
      const month = getMonthRange(monthOffset);
      periodStart = month.start;
      periodEnd = month.end;
      // histórico: 3 meses anteriores
      const histEnd = new Date(periodStart);
      histEnd.setDate(histEnd.getDate() - 1);
      const histStart = new Date(histEnd.getFullYear(), histEnd.getMonth() - 2, 1);
      historyStart = histStart.toISOString().split('T')[0];
      historyEnd = histEnd.toISOString().split('T')[0];
    }

    // Query período atual
    const currentQuery = supabase
      .from('class_bookings')
      .select('user_id, profiles!inner(full_name, belt, role, school_id, is_hidden, is_archived), classes!inner(date, school_id)')
      .eq('status', 'Presente')
      .gte('classes.date', periodStart)
      .lte('classes.date', periodEnd)
      .eq('profiles.school_id', selectedSchoolId)
      .eq('profiles.is_hidden', false)
      .eq('profiles.is_archived', false);

    // Query histórico para desempate
    const historyQuery = supabase
      .from('class_bookings')
      .select('user_id, profiles!inner(school_id, is_hidden, is_archived), classes!inner(date, school_id)')
      .eq('status', 'Presente')
      .gte('classes.date', historyStart)
      .lte('classes.date', historyEnd)
      .eq('profiles.school_id', selectedSchoolId)
      .eq('profiles.is_hidden', false)
      .eq('profiles.is_archived', false);

    const [{ data: currentData }, { data: historyData }] = await Promise.all([
      currentQuery,
      historyQuery,
    ]);

    // Calcular contagens do período atual
    const counts: Record<string, RankEntry> = {};
    (currentData as unknown as BookingRow[] || []).forEach((r) => {
      const uid = r.user_id;
      if (!counts[uid]) {
        counts[uid] = {
          user_id: uid,
          full_name: r.profiles?.full_name || 'Desconhecido',
          belt: r.profiles?.belt || 'Branco',
          role: r.profiles?.role || 'Atleta',
          count: 0,
          tiebreaker: 0,
        };
      }
      counts[uid].count++;
    });

    // Calcular histórico para desempate
    const historyCounts: Record<string, number> = {};
    (historyData as unknown as HistoryRow[] || []).forEach((r) => {
      historyCounts[r.user_id] = (historyCounts[r.user_id] || 0) + 1;
    });

    // Aplicar tiebreaker
    Object.keys(counts).forEach((uid) => {
      counts[uid].tiebreaker = historyCounts[uid] || 0;
    });

    // Filtrar 0 aulas e ordenar
    const sorted = Object.values(counts)
      .filter((e) => e.count > 0)
      .sort(sortWithTiebreaker);

    setRanking(sorted);
    setLoading(false);
  }, [selectedSchoolId, mode, weekOffset, monthOffset]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  const getPeriodLabel = () => {
    if (mode === 'weekly') return getWeekRange(weekOffset).label;
    return getMonthRange(monthOffset).label;
  };

  const getSchoolName = () => {
    if (isAdmin) {
      return schools.find((s) => s.id === selectedSchoolId)?.name || '';
    }
    return profile?.school?.name || '';
  };

  const exportPDF = async () => {
    setExporting(true);
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const schoolName = getSchoolName();
    const periodLabel = getPeriodLabel();
    const modeLabel = mode === 'weekly' ? 'Ranking Semanal' : 'Premiação Mensal';

    // Cabeçalho
    doc.setFillColor(18, 18, 18);
    doc.rect(0, 0, 210, 297, 'F');

    doc.setTextColor(16, 185, 129);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('ZR Team', 105, 18, { align: 'center' });

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text(`🥋 ${modeLabel}`, 105, 27, { align: 'center' });

    doc.setTextColor(160, 160, 160);
    doc.setFontSize(10);
    doc.text(schoolName, 105, 34, { align: 'center' });
    doc.text(periodLabel, 105, 40, { align: 'center' });

    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.line(14, 44, 196, 44);

    const tableRows = ranking.map((entry, idx) => [
      `${idx + 1}º`,
      entry.full_name,
      entry.belt,
      entry.role,
      String(entry.count),
    ]);

    autoTable(doc, {
      startY: 48,
      head: [['#', 'Nome', 'Faixa', 'Função', 'Presenças']],
      body: tableRows,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3,
        fillColor: [30, 30, 30],
        textColor: [230, 230, 230],
        lineColor: [60, 60, 60],
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [10, 10, 10],
        fontStyle: 'bold',
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [22, 22, 22],
      },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        4: { cellWidth: 22, halign: 'center' },
      },
    });

    const dateStr = new Date().toLocaleDateString('pt-PT').replace(/\//g, '-');
    const modeStr = mode === 'weekly' ? 'ranking_semanal' : 'premiacao_mensal';
    doc.save(`ZRTeam_${modeStr}_${dateStr}.pdf`);
    setExporting(false);
  };

  // Medalha / posição visual
  const getPositionIcon = (pos: number) => {
    if (pos === 1) return '🥇';
    if (pos === 2) return '🥈';
    if (pos === 3) return '🥉';
    return `${pos}º`;
  };

  const getBeltDot = (belt: string) => {
    const color = BELT_COLORS[belt] || '#6b7280';
    return (
      <span
        style={{
          display: 'inline-block',
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          background: color,
          border: '1px solid rgba(255,255,255,0.2)',
          flexShrink: 0,
          marginRight: '0.4rem',
        }}
      />
    );
  };

  const currentWeekRange = getWeekRange(weekOffset);
  const currentMonthRange = getMonthRange(monthOffset);

  if (!isAdmin && !isHeadProf) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        Não tens permissão para aceder a esta página.
      </div>
    );
  }

  return (
    <div className="animate-fade-in" style={{ maxWidth: '720px', margin: '0 auto' }}>
      {/* Cabeçalho */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1
          className="page-title"
          style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.25rem' }}
        >
          <BarChart2 size={24} style={{ color: 'var(--primary)' }} />
          Rankings
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          {isAdmin ? 'Todas as escolas — seleciona a escola e o período' : `${profile?.school?.name || ''} — ranking da tua escola`}
        </p>
      </div>

      {/* Filtros */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          padding: '1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.75rem',
          alignItems: 'flex-end',
        }}
      >
        {/* Escola (apenas Admin) */}
        {isAdmin && schools.length > 0 && (
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Escola
            </label>
            <div style={{ position: 'relative' }}>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg-dark)',
                  border: '1px solid var(--border)',
                  borderRadius: '0.6rem',
                  padding: '0.55rem 2rem 0.55rem 0.75rem',
                  color: 'var(--text-main)',
                  fontSize: '0.875rem',
                  appearance: 'none',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                {schools.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown size={14} style={{ position: 'absolute', right: '0.6rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            </div>
          </div>
        )}

        {/* Modo */}
        <div style={{ flex: '1 1 200px' }}>
          <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
            Tipo de Ranking
          </label>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button
              onClick={() => setMode('weekly')}
              style={{
                flex: 1,
                padding: '0.5rem 0.5rem',
                borderRadius: '0.5rem',
                border: mode === 'weekly' ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: mode === 'weekly' ? 'rgba(16,185,129,0.1)' : 'var(--bg-dark)',
                color: mode === 'weekly' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: mode === 'weekly' ? 700 : 400,
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
              }}
            >
              <Medal size={14} /> Semanal
            </button>
            <button
              onClick={() => setMode('monthly')}
              style={{
                flex: 1,
                padding: '0.5rem 0.5rem',
                borderRadius: '0.5rem',
                border: mode === 'monthly' ? '1px solid var(--primary)' : '1px solid var(--border)',
                background: mode === 'monthly' ? 'rgba(16,185,129,0.1)' : 'var(--bg-dark)',
                color: mode === 'monthly' ? 'var(--primary)' : 'var(--text-muted)',
                cursor: 'pointer',
                fontSize: '0.8rem',
                fontWeight: mode === 'monthly' ? 700 : 400,
                transition: 'all 0.2s',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem',
              }}
            >
              <Trophy size={14} /> Premiação
            </button>
          </div>
        </div>

        {/* Período semanal */}
        {mode === 'weekly' && (
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Semana
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {([0, 1] as WeekOffset[]).map((off) => {
                return (
                  <button
                    key={off}
                    onClick={() => setWeekOffset(off)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.3rem',
                      borderRadius: '0.5rem',
                      border: weekOffset === off ? '1px solid var(--primary)' : '1px solid var(--border)',
                      background: weekOffset === off ? 'rgba(16,185,129,0.1)' : 'var(--bg-dark)',
                      color: weekOffset === off ? 'var(--primary)' : 'var(--text-muted)',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: weekOffset === off ? 700 : 400,
                      transition: 'all 0.2s',
                    }}
                  >
                    {off === 0 ? 'Atual' : 'Anterior'}
                  </button>
                );
              })}
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {currentWeekRange.start} → {currentWeekRange.end}
            </p>
          </div>
        )}

        {/* Período mensal */}
        {mode === 'monthly' && (
          <div style={{ flex: '1 1 180px' }}>
            <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: '0.35rem' }}>
              Mês
            </label>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {([0, 1] as MonthOffset[]).map((off) => (
                <button
                  key={off}
                  onClick={() => setMonthOffset(off)}
                  style={{
                    flex: 1,
                    padding: '0.5rem 0.3rem',
                    borderRadius: '0.5rem',
                    border: monthOffset === off ? '1px solid var(--primary)' : '1px solid var(--border)',
                    background: monthOffset === off ? 'rgba(16,185,129,0.1)' : 'var(--bg-dark)',
                    color: monthOffset === off ? 'var(--primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    fontWeight: monthOffset === off ? 700 : 400,
                    transition: 'all 0.2s',
                  }}
                >
                  {off === 0 ? 'Atual' : 'Anterior'}
                </button>
              ))}
            </div>
            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
              {currentMonthRange.monthName.charAt(0).toUpperCase() + currentMonthRange.monthName.slice(1)}
            </p>
          </div>
        )}

        {/* Botão Exportar */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            onClick={exportPDF}
            disabled={exporting || loading || ranking.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              padding: '0.55rem 1.1rem',
              borderRadius: '0.6rem',
              border: 'none',
              background: ranking.length === 0 ? 'rgba(16,185,129,0.1)' : 'var(--primary)',
              color: ranking.length === 0 ? 'var(--text-muted)' : '#000',
              fontWeight: 700,
              fontSize: '0.85rem',
              cursor: ranking.length === 0 ? 'not-allowed' : 'pointer',
              transition: 'opacity 0.2s',
              opacity: exporting ? 0.6 : 1,
              whiteSpace: 'nowrap',
            }}
          >
            <Download size={16} />
            {exporting ? 'A exportar...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      {/* Título do resultado */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {mode === 'weekly' ? '🏅 Ranking Semanal' : '🏆 Premiação Mensal'}
          </h2>
          <p style={{ margin: '0.2rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {getPeriodLabel()} · {getSchoolName()}
          </p>
        </div>
        <span style={{
          background: 'rgba(16,185,129,0.1)',
          border: '1px solid rgba(16,185,129,0.2)',
          borderRadius: '9999px',
          padding: '0.2rem 0.65rem',
          fontSize: '0.75rem',
          color: 'var(--primary)',
          fontWeight: 700,
        }}>
          {loading ? '...' : `${ranking.length} atleta${ranking.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Lista */}
      <div
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: '1rem',
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            A carregar ranking...
          </div>
        ) : ranking.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Sem presenças no período selecionado.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', width: '48px' }}>
                  #
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  Nome
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', display: 'none' }}
                  className="hide-mobile"
                >
                  Faixa
                </th>
                <th style={{ padding: '0.75rem 1rem', textAlign: 'right', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', width: '90px' }}>
                  Presenças
                </th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((entry, idx) => {
                const pos = idx + 1;
                const isTop3 = pos <= 3;
                const barMax = ranking[0]?.count || 1;
                const barPct = Math.max(6, Math.round((entry.count / barMax) * 100));
                const barColor =
                  pos === 1 ? 'linear-gradient(90deg, #f59e0b, #fcd34d)' :
                  pos === 2 ? 'linear-gradient(90deg, #9ca3af, #d1d5db)' :
                  pos === 3 ? 'linear-gradient(90deg, #b45309, #d97706)' :
                  'var(--primary)';

                return (
                  <tr
                    key={entry.user_id}
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.04)',
                      background: isTop3 ? 'rgba(255,255,255,0.02)' : 'transparent',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = isTop3 ? 'rgba(255,255,255,0.02)' : 'transparent'; }}
                  >
                    {/* Posição */}
                    <td style={{ padding: '0.875rem 1rem', fontSize: '1rem', width: '48px' }}>
                      {getPositionIcon(pos)}
                    </td>

                    {/* Nome + Faixa + Barra */}
                    <td style={{ padding: '0.875rem 1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                        {getBeltDot(entry.belt)}
                        <span style={{ fontSize: '0.9rem', fontWeight: isTop3 ? 700 : 500, color: 'white' }}>
                          {entry.full_name}
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic', marginLeft: '0.1rem' }}>
                          · {entry.belt}
                        </span>
                      </div>
                      {/* Barra de progresso */}
                      <div style={{ height: '5px', borderRadius: '9999px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden', maxWidth: '280px' }}>
                        <div style={{
                          height: '100%',
                          width: `${barPct}%`,
                          borderRadius: '9999px',
                          background: barColor,
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                    </td>

                    {/* Nº Presenças */}
                    <td style={{ padding: '0.875rem 1rem', textAlign: 'right', fontWeight: 800, fontSize: '1.05rem', color: isTop3 ? 'var(--primary)' : 'white', width: '90px' }}>
                      {entry.count}
                      <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '0.25rem' }}>aulas</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Nota de desempate */}
      {ranking.length > 0 && !loading && (
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.75rem', textAlign: 'center', lineHeight: 1.5 }}>
          ℹ️ Em caso de empate no número de presenças, é aplicado um critério de desempate com base no histórico {mode === 'weekly' ? 'das 4 semanas' : 'dos 3 meses'} anteriores.
        </p>
      )}

      <style>{`
        @media (max-width: 600px) {
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </div>
  );
}
