import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, User, ShieldCheck, Trash2, AlertTriangle, Edit2, Save, X } from 'lucide-react';

const BELTS = [
    'Cinza/ branco', 'Cinza', 'Cinza/ Preto',
    'Amarelo / Branco', 'Amarelo', 'Amarelo/ preto',
    'Laranja/ Branco', 'Laranja', 'Laranja/ preto',
    'Verde / Branco', 'Verde', 'Verde / Preto',
    'Branco', 'Azul', 'Roxo', 'Marrom', 'Preto'
];

export default function Settings() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [editingProfile, setEditingProfile] = useState(false);
    const [editForm, setEditForm] = useState<any>({});
    const [schools, setSchools] = useState<any[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<string | null>(null);

    const currentMonth = new Date().toLocaleString('pt-PT', { month: 'long' });
    const currentYear = new Date().getFullYear();

    useEffect(() => {
        async function fetchPaymentStatus() {
            if (!profile?.id) return;
            const now = new Date();
            const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
            const month = monthNames[now.getMonth()];
            const year = now.getFullYear();

            const { data } = await supabase
                .from('payments')
                .select('status')
                .eq('athlete_id', profile.id)
                .eq('month', month)
                .eq('year', year)
                .maybeSingle();

            if (data) {
                setPaymentStatus(data.status);
            } else {
                setPaymentStatus('Pendente');
            }
        }
        async function loadOptions() {
            const { data: schoolsData } = await supabase.from('schools').select('id, name').order('name');
            if (schoolsData) setSchools(schoolsData);
            const { data: profsData } = await supabase
                .from('profiles')
                .select('id, full_name, school_id')
                .in('role', ['Professor', 'Admin'])
                .order('full_name');
            if (profsData) setProfessors(profsData);
        }
        fetchPaymentStatus();
        loadOptions();
    }, [profile?.id]);

    const startEditProfile = () => {
        setEditForm({
            full_name: profile.full_name || '',
            date_of_birth: profile.date_of_birth || '',
            belt: profile.belt || 'Branco',
            degrees: profile.degrees ?? 0,
            school_id: profile.school_id || '',
            assigned_professor_id: profile.assigned_professor_id || '',
        });
        setEditingProfile(true);
    };

    const handleSaveProfile = async () => {
        setLoading(true);
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: editForm.full_name,
                date_of_birth: editForm.date_of_birth || null,
                belt: editForm.belt,
                degrees: parseInt(editForm.degrees),
                school_id: editForm.school_id || null,
                assigned_professor_id: editForm.assigned_professor_id || null,
            })
            .eq('id', profile.id);

        if (!error) {
            setMessage({ type: 'success', text: 'Perfil atualizado com sucesso!' });
            setEditingProfile(false);
            // Forçar reload do perfil no contexto (via reload simples)
            window.location.reload();
        } else {
            setMessage({ type: 'error', text: 'Erro ao guardar: ' + error.message });
        }
        setLoading(false);
        setTimeout(() => setMessage(null), 4000);
    };

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'As palavras-passe não coincidem.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setMessage({ type: 'error', text: 'Erro ao atualizar: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Palavra-passe atualizada com sucesso!' });
            setPassword('');
            setConfirmPassword('');
        }
        setLoading(false);
    };

    const handleDeleteAccount = async () => {
        const confirm1 = confirm('Tens a certeza que queres eliminar a tua conta? Esta ação é IRREVERSÍVEL e todos os teus dados serão apagados.');
        if (!confirm1) return;

        const confirm2 = prompt('Para confirmar a eliminação, escreve "ELIMINAR" na caixa abaixo:');
        if (confirm2 !== 'ELIMINAR') {
            alert('Confirmação incorreta. A conta não foi eliminada.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.rpc('delete_own_user');
            if (error) throw error;

            await supabase.auth.signOut();
            window.location.href = '/';
        } catch (err: any) {
            alert('Erro ao eliminar conta: ' + err.message);
            setLoading(false);
        }
    };

    return (
        <div className="settings-page animate-fade-in">
            <h1 className="page-title">Área Pessoal</h1>

            <div className="settings-grid">
                <div className="settings-card">
                    <div className="card-header">
                        <User className="text-primary" />
                        <h2>O Teu Perfil</h2>
                        {!editingProfile && (
                            <button onClick={startEditProfile} style={{ marginLeft: 'auto', background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)', borderRadius: '0.5rem', padding: '0.3rem 0.6rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem' }}>
                                <Edit2 size={14} /> Editar
                            </button>
                        )}
                    </div>

                    {message && (
                        <div className={`message-box message-${message.type}`}>
                            <ShieldCheck size={18} /> {message.text}
                        </div>
                    )}

                    {editingProfile ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div className="form-group">
                                <label className="form-label">Nome Completo</label>
                                <input className="form-input" value={editForm.full_name} onChange={e => setEditForm((f: any) => ({ ...f, full_name: e.target.value }))} />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data de Nascimento</label>
                                <input type="date" className="form-input" value={editForm.date_of_birth} onChange={e => setEditForm((f: any) => ({ ...f, date_of_birth: e.target.value }))} />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Faixa</label>
                                    <select className="form-input" value={editForm.belt} onChange={e => setEditForm((f: any) => ({ ...f, belt: e.target.value }))}>
                                        {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Grau</label>
                                    <select className="form-input" value={editForm.degrees} onChange={e => setEditForm((f: any) => ({ ...f, degrees: e.target.value }))}>
                                        {[0, 1, 2, 3, 4].map(d => <option key={d} value={d}>{d}°</option>)}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Escola</label>
                                <select className="form-input" value={editForm.school_id} onChange={e => setEditForm((f: any) => ({ ...f, school_id: e.target.value, assigned_professor_id: '' }))}>
                                    <option value="">Sem Escola</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Professor</label>
                                <select className="form-input" value={editForm.assigned_professor_id} onChange={e => setEditForm((f: any) => ({ ...f, assigned_professor_id: e.target.value }))}>
                                    <option value="">Nenhum</option>
                                    {professors.filter(p => !editForm.school_id || p.school_id === editForm.school_id).map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                </select>
                            </div>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                                <button onClick={() => setEditingProfile(false)} style={{ flex: 1, padding: '0.6rem', borderRadius: '0.5rem', background: 'var(--bg-dark)', border: '1px solid var(--border)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                                    <X size={16} /> Cancelar
                                </button>
                                <button onClick={handleSaveProfile} disabled={loading} style={{ flex: 1, padding: '0.6rem', borderRadius: '0.5rem', background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', fontWeight: 600 }}>
                                    <Save size={16} /> {loading ? 'A guardar...' : 'Guardar'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="profile-info">
                            <div className="info-item">
                                <label>Nome Completo</label>
                                <p>{profile.full_name}</p>
                            </div>
                            <div className="info-item">
                                <label>Função</label>
                                <p><span className="role-badge">{profile.role}</span></p>
                            </div>
                            <div className="info-item">
                                <label>Escola</label>
                                <p>{profile.school?.name || 'Não associada'}</p>
                            </div>
                            <div className="info-item">
                                <label>Data de Nascimento</label>
                                <p>{profile.date_of_birth ? new Date(profile.date_of_birth).toLocaleDateString('pt-PT') : '—'}</p>
                            </div>
                            <div className="info-item">
                                <label>Faixa / Graduação</label>
                                <p>{profile.belt} - {profile.degrees} Graus</p>
                            </div>
                            <div className="info-item">
                                <label>Professor Responsável</label>
                                <p>{profile.assigned_professor?.full_name || <span className="text-muted">Nenhum atribuído</span>}</p>
                            </div>
                            <div className="info-item">
                                <label>Mensalidade ({currentMonth} {currentYear})</label>
                                <p>
                                    <span className={`payment-badge ${paymentStatus === 'Pago' ? 'paid' : 'pending'}`}>
                                        {paymentStatus || 'A carregar...'}
                                    </span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="settings-card">
                    <div className="card-header">
                        <Lock className="text-primary" />
                        <h2>Segurança</h2>
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Altera a tua palavra-passe de acesso à plataforma.
                    </p>

                    {message && (
                        <div className={`message-box message-${message.type}`}>
                            <ShieldCheck size={18} /> {message.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdatePassword}>
                        <div className="form-group">
                            <label className="form-label">Nova Palavra-passe</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirmar Palavra-passe</label>
                            <input
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repete a nova palavra-passe"
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'A guardar...' : 'Atualizar Palavra-passe'}
                        </button>
                    </form>
                </div>

                <div className="settings-card danger-zone">
                    <div className="card-header">
                        <AlertTriangle className="text-danger" />
                        <h2>Zona de Perigo</h2>
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Uma vez eliminada, a tua conta e todos os teus dados associados (presenças, pagamentos, etc.) não podem ser recuperados.
                    </p>
                    <button
                        onClick={handleDeleteAccount}
                        className="btn-danger-outline w-full"
                        disabled={loading}
                    >
                        <Trash2 size={18} /> Eliminar a Minha Conta
                    </button>
                </div>
            </div>

            <style>{`
                .settings-page { max-width: 1000px; margin: 0 auto; }
                .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; }
                .settings-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; }
                .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
                .card-header h2 { font-size: 1.25rem; color: white; margin: 0; }
                
                .profile-info { display: flex; flex-direction: column; gap: 1.25rem; }
                .info-item label { display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
                .info-item p { color: white; font-weight: 500; }
                
                .message-box { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; }
                .message-success { background: rgba(16, 185, 129, 0.1); color: var(--primary); border: 1px solid rgba(16, 185, 129, 0.2); }
                .message-error { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); }
                
                .text-muted { color: var(--text-muted); }
                .text-danger { color: var(--danger); }
                .role-badge { background: rgba(16, 185, 129, 0.1); color: var(--primary); padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; }
                .danger-zone { border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.02); }
                .btn-danger-outline {
                    display: flex; align-items: center; justify-content: center; gap: 0.75rem;
                    background: transparent; border: 1px solid var(--danger); color: var(--danger);
                    padding: 0.75rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer;
                    transition: all 0.2s;
                }
                .btn-danger-outline:hover:not(:disabled) { background: var(--danger); color: white; }
                .w-full { width: 100%; }

                .payment-badge { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 700; display: inline-block; }
                .payment-badge.paid { background: rgba(16, 185, 129, 0.1); color: var(--primary); border: 1px solid rgba(16, 185, 129, 0.2); }
                .payment-badge.pending { background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); }
            `}</style>
        </div>
    );
}
