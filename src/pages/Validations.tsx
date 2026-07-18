import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isProfessor as checkIsProfessor } from '../lib/roles';
import { CheckCircle, XCircle, Clock, AlertTriangle, UserCheck, Award, ChevronDown, ChevronUp } from 'lucide-react';

export default function Validations() {
    const { profile } = useOutletContext<{ profile: any }>();

    // ── Validação de novos atletas ──
    const [pendingAthletes, setPendingAthletes] = useState<any[]>([]);
    const [loadingAthletes, setLoadingAthletes] = useState(true);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [filterSchool, setFilterSchool] = useState<string>('all');
    const [schools, setSchools] = useState<any[]>([]);

    // ── Pedidos de mudança de grau/faixa ──
    const [gradeRequests, setGradeRequests] = useState<any[]>([]);
    const [loadingGrade, setLoadingGrade] = useState(true);
    const [gradeFeedback, setGradeFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [expandedRequest, setExpandedRequest] = useState<string | null>(null);
    const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
    const [processingId, setProcessingId] = useState<string | null>(null);

    const isAdmin = profile?.role === 'Admin';
    const isProfessor = checkIsProfessor(profile?.role);
    const isHeadProfessor = profile?.school?.head_professor_id === profile?.id;
    const canValidate = isAdmin || (isProfessor && isHeadProfessor);

    useEffect(() => {
        if (profile) {
            fetchPending();
            fetchGradeRequests();
            if (isAdmin) {
                supabase.from('schools').select('id, name').order('order_index', { ascending: true }).order('name')
                    .then(({ data }) => { if (data) setSchools(data); });
            }
        }
    }, [profile]);

    // ── Atletas pendentes ──
    async function fetchPending() {
        setLoadingAthletes(true);
        let query = supabase
            .from('profiles')
            .select('id, full_name, email, belt, degrees, date_of_birth, created_at, school:schools!school_id(id, name), assigned_professor:profiles!assigned_professor_id(full_name)')
            .eq('needs_validation', true)
            .eq('role', 'Atleta')
            .order('created_at', { ascending: true });

        if (!isAdmin && isHeadProfessor) {
            if (!profile.school_id) { setPendingAthletes([]); setLoadingAthletes(false); return; }
            query = query.eq('school_id', profile.school_id);
        }

        const { data, error } = await query;
        if (!error && data) setPendingAthletes(data);
        setLoadingAthletes(false);
    }

    async function validateAthlete(id: string, fullName: string) {
        const { error } = await supabase.rpc('validate_user', { target_user_id: id });
        if (!error) {
            setFeedback({ type: 'success', msg: `${fullName} validado com sucesso!` });
            fetchPending();
        } else {
            setFeedback({ type: 'error', msg: 'Erro: ' + error.message });
        }
        setTimeout(() => setFeedback(null), 3000);
    }

    async function rejectAthlete(athlete: any) {
        if (!confirm(`Tens a certeza que queres rejeitar e apagar a conta de ${athlete.full_name}? Esta ação é irreversível.`)) return;
        const { error } = await supabase.rpc('delete_user_and_auth', { user_id_param: athlete.id });
        if (!error) {
            setFeedback({ type: 'success', msg: `Conta de ${athlete.full_name} rejeitada e apagada.` });
            fetchPending();
        } else {
            setFeedback({ type: 'error', msg: 'Erro: ' + error.message });
        }
        setTimeout(() => setFeedback(null), 3000);
    }

    // ── Pedidos de graduação ──
    async function fetchGradeRequests() {
        setLoadingGrade(true);
        let query = supabase
            .from('grade_change_requests')
            .select(`
                *,
                athlete:profiles!athlete_id(full_name, belt, degrees, school_id, school:schools!school_id(id, name)),
                reviewer:profiles!reviewed_by(full_name)
            `)
            .eq('status', 'pendente')
            .order('created_at', { ascending: true });

        if (!isAdmin && isProfessor && profile.school_id) {
            // Filtrar só da escola do professor
            query = query.eq('athlete.school_id', profile.school_id);
        }

        const { data, error } = await query;
        if (!error && data) {
            // Filtro extra em JS para o caso do join não filtrar corretamente
            const filtered = isAdmin
                ? data
                : data.filter((r: any) => r.athlete?.school_id === profile.school_id);
            setGradeRequests(filtered);
        }
        setLoadingGrade(false);
    }

    async function approveGradeRequest(requestId: string, athleteName: string) {
        setProcessingId(requestId);
        const { error } = await supabase.rpc('approve_grade_change', {
            request_id_param: requestId,
            notes_param: null,
        });
        if (!error) {
            setGradeFeedback({ type: 'success', msg: `Graduação de ${athleteName} aprovada!` });
            fetchGradeRequests();
        } else {
            setGradeFeedback({ type: 'error', msg: 'Erro: ' + error.message });
        }
        setProcessingId(null);
        setTimeout(() => setGradeFeedback(null), 4000);
    }

    async function rejectGradeRequest(requestId: string, athleteName: string) {
        setProcessingId(requestId);
        const notes = rejectNotes[requestId] || '';
        const { error } = await supabase.rpc('reject_grade_change', {
            request_id_param: requestId,
            notes_param: notes || null,
        });
        if (!error) {
            setGradeFeedback({ type: 'success', msg: `Pedido de ${athleteName} rejeitado.` });
            setExpandedRequest(null);
            fetchGradeRequests();
        } else {
            setGradeFeedback({ type: 'error', msg: 'Erro: ' + error.message });
        }
        setProcessingId(null);
        setTimeout(() => setGradeFeedback(null), 4000);
    }

    if (!canValidate) {
        return (
            <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                Acesso restrito a Administradores e Professores Responsáveis.
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

            {/* ═══════════════════════════════════════════════════════
                SECÇÃO 1: VALIDAÇÃO DE NOVOS ATLETAS
            ═══════════════════════════════════════════════════════ */}
            <div style={{ marginBottom: '2.5rem' }}>
                <div style={{ marginBottom: '1.5rem' }}>
                    <h1 className="page-title">✅ Validação de Novos Atletas</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Confirma ou rejeita os registos de novos atletas na plataforma.
                    </p>
                </div>

                {isAdmin && schools.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                        <select
                            value={filterSchool}
                            onChange={e => setFilterSchool(e.target.value)}
                            style={{
                                background: 'var(--bg-card)', border: '1px solid var(--border)',
                                borderRadius: '0.5rem', padding: '0.45rem 0.9rem',
                                color: filterSchool !== 'all' ? 'var(--primary)' : 'var(--text-muted)',
                                fontSize: '0.85rem', cursor: 'pointer', outline: 'none'
                            }}
                        >
                            <option value="all">🏫 Todas as Escolas</option>
                            {schools.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                        {filterSchool !== 'all' && (
                            <button onClick={() => setFilterSchool('all')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.8rem' }}>
                                ✕ Limpar filtro
                            </button>
                        )}
                    </div>
                )}

                {feedback && (
                    <div style={{
                        padding: '0.75rem 1rem', borderRadius: '0.5rem',
                        marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500,
                        background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
                        border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>
                        {feedback.msg}
                    </div>
                )}

                {loadingAthletes ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Clock size={28} style={{ marginBottom: '0.5rem' }} />
                        <p>A carregar...</p>
                    </div>
                ) : pendingAthletes.filter(a => filterSchool === 'all' || a.school?.id === filterSchool).length === 0 ? (
                    <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: '1rem', padding: '3rem 2rem',
                        textAlign: 'center', color: 'var(--text-muted)'
                    }}>
                        <CheckCircle size={40} style={{ marginBottom: '0.75rem', color: 'var(--primary)' }} />
                        <p style={{ fontWeight: 600, color: 'white' }}>Tudo em dia!</p>
                        <p style={{ fontSize: '0.875rem' }}>Não há atletas pendentes de validação.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {pendingAthletes
                            .filter(a => filterSchool === 'all' || a.school?.id === filterSchool)
                            .map(athlete => (
                                <div key={athlete.id} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: '1rem', padding: '1.25rem',
                                    display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', gap: '1rem', flexWrap: 'wrap'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                        <div style={{
                                            width: '44px', height: '44px', borderRadius: '50%',
                                            background: 'rgba(16,185,129,0.1)', display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            fontSize: '1.25rem', flexShrink: 0
                                        }}>
                                            {athlete.full_name.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <p style={{ fontWeight: 700, color: 'white', margin: 0 }}>{athlete.full_name}</p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                                                {athlete.belt} {athlete.degrees !== undefined && `· ${athlete.degrees}° Grau`}
                                            </p>
                                            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.1rem 0 0' }}>
                                                {athlete.date_of_birth
                                                    ? `📅 ${new Date(athlete.date_of_birth).toLocaleDateString('pt-PT')}`
                                                    : '📅 Data nasc. n/d'
                                                }
                                                {athlete.school?.name && ` · 🏫 ${athlete.school.name}`}
                                            </p>
                                            {athlete.assigned_professor?.full_name && (
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.1rem 0 0' }}>
                                                    🥋 Prof. {athlete.assigned_professor.full_name}
                                                </p>
                                            )}
                                            <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: '0.15rem 0 0', opacity: 0.7 }}>
                                                Registado em {new Date(athlete.created_at).toLocaleDateString('pt-PT')}
                                            </p>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem' }}>
                                        <button
                                            onClick={() => rejectAthlete(athlete)}
                                            style={{
                                                padding: '0.5rem 1rem', borderRadius: '0.5rem',
                                                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                                color: '#ef4444', cursor: 'pointer', fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem'
                                            }}
                                        >
                                            <XCircle size={16} /> Rejeitar
                                        </button>
                                        <button
                                            onClick={() => validateAthlete(athlete.id, athlete.full_name)}
                                            style={{
                                                padding: '0.5rem 1rem', borderRadius: '0.5rem',
                                                background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                                                color: '#10b981', cursor: 'pointer', fontWeight: 600,
                                                display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem'
                                            }}
                                        >
                                            <UserCheck size={16} /> Validar
                                        </button>
                                    </div>
                                </div>
                            ))}
                    </div>
                )}

                <div style={{ marginTop: '1.5rem', padding: '1rem', background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: '0.75rem' }}>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                        <AlertTriangle size={14} style={{ display: 'inline', marginRight: '0.4rem', color: '#f59e0b' }} />
                        Enquanto a conta não for validada, o atleta pode fazer login mas não pode inscrever-se em aulas. Ao rejeitar, a conta é apagada permanentemente.
                    </p>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                SECÇÃO 2: PEDIDOS DE MUDANÇA DE GRAU/FAIXA
            ═══════════════════════════════════════════════════════ */}
            <div>
                <div style={{ marginBottom: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)' }}>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'white', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Award size={22} style={{ color: 'var(--primary)' }} /> Pedidos de Mudança de Graduação
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        Aprova ou rejeita os pedidos de mudança de faixa ou grau submetidos pelos atletas.
                    </p>
                </div>

                {gradeFeedback && (
                    <div style={{
                        padding: '0.75rem 1rem', borderRadius: '0.5rem',
                        marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500,
                        background: gradeFeedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                        color: gradeFeedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
                        border: `1px solid ${gradeFeedback.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    }}>
                        {gradeFeedback.msg}
                    </div>
                )}

                {loadingGrade ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                        <Clock size={28} style={{ marginBottom: '0.5rem' }} />
                        <p>A carregar...</p>
                    </div>
                ) : gradeRequests.length === 0 ? (
                    <div style={{
                        background: 'var(--bg-card)', border: '1px solid var(--border)',
                        borderRadius: '1rem', padding: '3rem 2rem',
                        textAlign: 'center', color: 'var(--text-muted)'
                    }}>
                        <CheckCircle size={40} style={{ marginBottom: '0.75rem', color: 'var(--primary)' }} />
                        <p style={{ fontWeight: 600, color: 'white' }}>Sem pedidos pendentes!</p>
                        <p style={{ fontSize: '0.875rem' }}>Não há pedidos de mudança de grau/faixa por processar.</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {gradeRequests.map((req: any) => {
                            const isExpanded = expandedRequest === req.id;
                            const isProcessing = processingId === req.id;

                            return (
                                <div key={req.id} style={{
                                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                                    borderRadius: '1rem', overflow: 'hidden',
                                }}>
                                    {/* Cabeçalho do pedido */}
                                    <div style={{
                                        padding: '1.25rem',
                                        display: 'flex', justifyContent: 'space-between',
                                        alignItems: 'center', gap: '1rem', flexWrap: 'wrap'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                            <div style={{
                                                width: '44px', height: '44px', borderRadius: '50%',
                                                background: 'rgba(16,185,129,0.1)', display: 'flex',
                                                alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.2rem', fontWeight: 700, color: 'var(--primary)', flexShrink: 0
                                            }}>
                                                {req.athlete?.full_name?.charAt(0).toUpperCase() || '?'}
                                            </div>
                                            <div>
                                                <p style={{ fontWeight: 700, color: 'white', margin: 0, fontSize: '0.95rem' }}>
                                                    {req.athlete?.full_name || 'Atleta desconhecido'}
                                                </p>
                                                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
                                                    {req.athlete?.school?.name && `🏫 ${req.athlete.school.name} · `}
                                                    Pedido em {new Date(req.created_at).toLocaleDateString('pt-PT')}
                                                </p>
                                                {/* Seta de progressão */}
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', flexWrap: 'wrap' }}>
                                                    <span style={{
                                                        fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
                                                        background: 'rgba(100,116,139,0.15)', border: '1px solid rgba(100,116,139,0.2)', color: '#94a3b8'
                                                    }}>
                                                        {req.current_belt}, {req.current_degrees}° Grau
                                                    </span>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>→</span>
                                                    <span style={{
                                                        fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '9999px',
                                                        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#10b981', fontWeight: 700
                                                    }}>
                                                        {req.requested_belt}, {req.requested_degrees}° Grau
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Botões de ação */}
                                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => setExpandedRequest(isExpanded ? null : req.id)}
                                                style={{
                                                    padding: '0.45rem 0.8rem', borderRadius: '0.5rem',
                                                    background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.2)',
                                                    color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.8rem'
                                                }}
                                            >
                                                {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                                {isExpanded ? 'Fechar' : 'Rejeitar...'}
                                            </button>
                                            <button
                                                onClick={() => approveGradeRequest(req.id, req.athlete?.full_name)}
                                                disabled={isProcessing}
                                                style={{
                                                    padding: '0.45rem 1rem', borderRadius: '0.5rem',
                                                    background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
                                                    color: '#10b981', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 600,
                                                    display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem',
                                                    opacity: isProcessing ? 0.6 : 1
                                                }}
                                            >
                                                <CheckCircle size={15} /> {isProcessing ? 'A processar...' : 'Aprovar'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Painel de rejeição (expandível) */}
                                    {isExpanded && (
                                        <div style={{
                                            padding: '1rem 1.25rem 1.25rem',
                                            borderTop: '1px solid var(--border)',
                                            background: 'rgba(239,68,68,0.02)'
                                        }}>
                                            <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>
                                                Motivo de rejeição (opcional)
                                            </label>
                                            <textarea
                                                value={rejectNotes[req.id] || ''}
                                                onChange={e => setRejectNotes(n => ({ ...n, [req.id]: e.target.value }))}
                                                placeholder="Ex: Ainda não atingiu o número de aulas necessário..."
                                                rows={2}
                                                style={{
                                                    width: '100%', background: 'var(--bg-dark)', border: '1px solid var(--border)',
                                                    borderRadius: '0.5rem', padding: '0.6rem 0.75rem', color: 'white', fontSize: '0.85rem',
                                                    resize: 'vertical', boxSizing: 'border-box', outline: 'none', fontFamily: 'inherit'
                                                }}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
                                                <button
                                                    onClick={() => rejectGradeRequest(req.id, req.athlete?.full_name)}
                                                    disabled={isProcessing}
                                                    style={{
                                                        padding: '0.5rem 1.1rem', borderRadius: '0.5rem',
                                                        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
                                                        color: '#ef4444', cursor: isProcessing ? 'not-allowed' : 'pointer', fontWeight: 600,
                                                        display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem',
                                                        opacity: isProcessing ? 0.6 : 1
                                                    }}
                                                >
                                                    <XCircle size={15} /> {isProcessing ? 'A processar...' : 'Confirmar Rejeição'}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
