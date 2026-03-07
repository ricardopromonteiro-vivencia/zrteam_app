import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isProfessor as checkIsProfessor } from '../lib/roles';
import { CheckCircle, XCircle, Clock, AlertTriangle, UserCheck } from 'lucide-react';

export default function Validations() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [pendingAthletes, setPendingAthletes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
    const [filterSchool, setFilterSchool] = useState<string>('all');
    const [schools, setSchools] = useState<any[]>([]);

    const isAdmin = profile?.role === 'Admin';
    const isProfessor = checkIsProfessor(profile?.role);
    const isHeadProfessor = profile?.school?.head_professor_id === profile?.id;
    const canValidate = isAdmin || (isProfessor && isHeadProfessor);

    useEffect(() => {
        if (profile) {
            fetchPending();
            if (isAdmin) {
                supabase.from('schools').select('id, name').order('name')
                    .then(({ data }) => { if (data) setSchools(data); });
            }
        }
    }, [profile]);

    async function fetchPending() {
        setLoading(true);
        let query = supabase
            .from('profiles')
            .select('id, full_name, email, belt, degrees, date_of_birth, created_at, school:schools!school_id(id, name), assigned_professor:profiles!assigned_professor_id(full_name)')
            .eq('needs_validation', true)
            .eq('role', 'Atleta')
            .order('created_at', { ascending: true });

        if (isAdmin) {
            // Admin vê todos, sem filtro de escola
        } else if (isHeadProfessor) {
            // Professor Responsável: só vê os da sua escola
            if (!profile.school_id) {
                setPendingAthletes([]);
                setLoading(false);
                return;
            }
            query = query.eq('school_id', profile.school_id);
        }

        const { data, error } = await query;
        if (!error && data) setPendingAthletes(data);
        setLoading(false);
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

    if (!canValidate) {
        return (
            <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>
                Acesso restrito a Administradores e Professores Responsáveis.
            </div>
        );
    }

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ marginBottom: '1.5rem' }}>
                <h1 className="page-title">✅ Validação de Novos Atletas</h1>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                    Confirma ou rejeita os registos de novos atletas na plataforma.
                </p>
            </div>

            {/* Filtro de escola para Admin */}
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
                <div className={`feedback-bar feedback-${feedback.type}`} style={{
                    padding: '0.75rem 1rem', borderRadius: '0.5rem',
                    marginBottom: '1rem', fontSize: '0.875rem', fontWeight: 500,
                    background: feedback.type === 'success' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: feedback.type === 'success' ? '#6ee7b7' : '#fca5a5',
                    border: `1px solid ${feedback.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                }}>
                    {feedback.msg}
                </div>
            )}

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--text-muted)' }}>
                    <Clock size={32} style={{ marginBottom: '0.5rem' }} />
                    <p>A carregar...</p>
                </div>
            ) : pendingAthletes.length === 0 ? (
                <div style={{
                    background: 'var(--bg-card)', border: '1px solid var(--border)',
                    borderRadius: '1rem', padding: '4rem 2rem',
                    textAlign: 'center', color: 'var(--text-muted)'
                }}>
                    <CheckCircle size={48} style={{ marginBottom: '1rem', color: 'var(--primary)' }} />
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
    );
}
