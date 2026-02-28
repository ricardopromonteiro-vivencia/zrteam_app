import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Edit2, Save, X, Search, Users } from 'lucide-react';

const BELTS = ['Branca', 'Azul', 'Roxa', 'Marrom', 'Preta', 'Coral', 'Vermelha'];
const ROLES = ['Atleta', 'Professor', 'Admin'];

interface Profile {
    id: string;
    full_name: string;
    role: string;
    belt: string;
    degrees: number;
    attended_classes: number;
    school_id: string | null;
    date_of_birth: string | null;
    created_at: string;
    school?: { name: string };
}

export default function Athletes() {
    const { profile: myProfile } = useOutletContext<{ profile: any }>();
    const [athletes, setAthletes] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editForm, setEditForm] = useState<Partial<Profile>>({});
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

    const isAdmin = myProfile?.role === 'Admin';

    const [schools, setSchools] = useState<any[]>([]);
    const [selectedSchool, setSelectedSchool] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

    useEffect(() => {
        fetchAthletes();
        loadSchools();
    }, [selectedSchool, sortOrder]);

    async function loadSchools() {
        const { data } = await supabase.from('schools').select('id, name');
        if (data) setSchools(data);
    }

    async function fetchAthletes() {
        setLoading(true);
        let query = supabase
            .from('profiles')
            .select('*, school:schools(name)')
            .order('full_name', { ascending: sortOrder === 'asc' });

        if (myProfile?.role === 'Professor') {
            query = query.eq('school_id', myProfile.school_id);
        } else if (isAdmin && selectedSchool !== 'all') {
            query = query.eq('school_id', selectedSchool);
        }

        const { data, error } = await query;
        if (!error && data) setAthletes(data);
        setLoading(false);
    }

    function calculateAge(dob: string | null) {
        if (!dob) return '—';
        const birthDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const m = today.getMonth() - birthDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        return age;
    }

    function startEdit(athlete: Profile) {
        setEditingId(athlete.id);
        setEditForm({ ...athlete });
    }

    function cancelEdit() {
        setEditingId(null);
        setEditForm({});
    }

    async function saveEdit() {
        if (!editingId) return;
        setSaving(true);
        const { error } = await supabase
            .from('profiles')
            .update({
                full_name: editForm.full_name,
                role: editForm.role,
                belt: editForm.belt,
                degrees: Number(editForm.degrees),
                attended_classes: Number(editForm.attended_classes),
                school_id: editForm.school_id,
                date_of_birth: editForm.date_of_birth,
            })
            .eq('id', editingId);

        if (error) {
            setFeedback({ type: 'error', msg: 'Erro ao guardar: ' + error.message });
        } else {
            setFeedback({ type: 'success', msg: 'Perfil atualizado com sucesso!' });
            await fetchAthletes();
            cancelEdit();
        }
        setSaving(false);
        setTimeout(() => setFeedback(null), 3000);
    }

    const filtered = athletes.filter(a =>
        a.full_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.belt?.toLowerCase().includes(search.toLowerCase()) ||
        a.role?.toLowerCase().includes(search.toLowerCase())
    );

    const beltColors: Record<string, string> = {
        Branca: '#ffffff', Azul: '#2563eb', Roxa: '#9333ea',
        Marrom: '#92400e', Preta: '#111827', Coral: '#f97316', Vermelha: '#dc2626'
    };

    return (
        <div className="athletes-page">
            <div className="athletes-header">
                <div>
                    <h1 className="page-title">Gestão de Atletas</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                        {athletes.length} utilizador{athletes.length !== 1 ? 'es' : ''} registado{athletes.length !== 1 ? 's' : ''}
                    </p>
                </div>
                <div className="header-actions">
                    {isAdmin && (
                        <select
                            className="filter-select"
                            value={selectedSchool}
                            onChange={e => setSelectedSchool(e.target.value)}
                        >
                            <option value="all">Todas as Escolas</option>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    )}
                    <div className="search-box">
                        <Search size={16} style={{ color: 'var(--text-muted)' }} />
                        <input
                            type="text"
                            placeholder="Pesquisar..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="search-input"
                        />
                    </div>
                </div>
            </div>

            {feedback && (
                <div className={`feedback-bar feedback-${feedback.type}`}>
                    {feedback.msg}
                </div>
            )}

            {loading ? (
                <div className="loading-state">A carregar atletas...</div>
            ) : filtered.length === 0 ? (
                <div className="empty-state">
                    <Users size={48} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <p>Nenhum atleta encontrado.</p>
                </div>
            ) : (
                <div className="athletes-table-wrapper">
                    <table className="athletes-table">
                        <thead>
                            <tr>
                                <th onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} style={{ cursor: 'pointer' }}>
                                    Nome {sortOrder === 'asc' ? '↑' : '↓'}
                                </th>
                                <th>Escola</th>
                                <th>Idade</th>
                                <th>Role</th>
                                <th>Faixa</th>
                                <th>Graus</th>
                                <th>Aulas</th>
                                <th>Membro desde</th>
                                {isAdmin && <th>Ações</th>}
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(athlete => (
                                <tr key={athlete.id} className={editingId === athlete.id ? 'editing-row' : ''}>
                                    {editingId === athlete.id ? (
                                        <>
                                            <td>
                                                <input
                                                    className="table-input"
                                                    value={editForm.full_name || ''}
                                                    onChange={e => setEditForm(f => ({ ...f, full_name: e.target.value }))}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="table-select"
                                                    value={editForm.school_id || ''}
                                                    onChange={e => setEditForm(f => ({ ...f, school_id: e.target.value }))}
                                                >
                                                    <option value="">Sem Escola</option>
                                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    className="table-input"
                                                    type="date"
                                                    value={editForm.date_of_birth || ''}
                                                    onChange={e => setEditForm(f => ({ ...f, date_of_birth: e.target.value }))}
                                                />
                                            </td>
                                            <td>
                                                <select
                                                    className="table-select"
                                                    value={editForm.role || 'Atleta'}
                                                    onChange={e => setEditForm(f => ({ ...f, role: e.target.value }))}
                                                >
                                                    {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <select
                                                    className="table-select"
                                                    value={editForm.belt || 'Branca'}
                                                    onChange={e => setEditForm(f => ({ ...f, belt: e.target.value }))}
                                                >
                                                    {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
                                                </select>
                                            </td>
                                            <td>
                                                <input
                                                    className="table-input table-input-sm"
                                                    type="number" min={0} max={4}
                                                    value={editForm.degrees ?? 0}
                                                    onChange={e => setEditForm(f => ({ ...f, degrees: +e.target.value }))}
                                                />
                                            </td>
                                            <td>
                                                <input
                                                    className="table-input table-input-sm"
                                                    type="number" min={0}
                                                    value={editForm.attended_classes ?? 0}
                                                    onChange={e => setEditForm(f => ({ ...f, attended_classes: +e.target.value }))}
                                                />
                                            </td>
                                            <td>{new Date(athlete.created_at).toLocaleDateString('pt-PT')}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                    <button className="btn-icon btn-save" onClick={saveEdit} disabled={saving} title="Guardar">
                                                        <Save size={16} />
                                                    </button>
                                                    <button className="btn-icon btn-cancel" onClick={cancelEdit} title="Cancelar">
                                                        <X size={16} />
                                                    </button>
                                                </div>
                                            </td>
                                        </>
                                    ) : (
                                        <>
                                            <td className="athlete-name">{athlete.full_name}</td>
                                            <td className="text-muted">{athlete.school?.name || '—'}</td>
                                            <td>{calculateAge(athlete.date_of_birth)}</td>
                                            <td>
                                                <span className={`role-pill role-${athlete.role?.toLowerCase()}`}>{athlete.role}</span>
                                            </td>
                                            <td>
                                                <span className="belt-chip">
                                                    <span
                                                        className="belt-dot"
                                                        style={{ backgroundColor: beltColors[athlete.belt] || '#fff', border: athlete.belt === 'Branca' ? '1px solid #555' : 'none' }}
                                                    />
                                                    {athlete.belt}
                                                </span>
                                            </td>
                                            <td className="text-center">{athlete.degrees}°</td>
                                            <td className="text-center">{athlete.attended_classes}</td>
                                            <td className="text-muted">{new Date(athlete.created_at).toLocaleDateString('pt-PT')}</td>
                                            {isAdmin && (
                                                <td>
                                                    <button
                                                        className="btn-icon btn-edit"
                                                        onClick={() => startEdit(athlete)}
                                                        title="Editar atleta"
                                                    >
                                                        <Edit2 size={16} />
                                                    </button>
                                                </td>
                                            )}
                                        </>
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
        .athletes-page { max-width: 1200px; margin: 0 auto; }
        .athletes-header {
          display: flex; justify-content: space-between; align-items: flex-start;
          gap: 1rem; margin-bottom: 1.5rem; flex-wrap: wrap;
        }
        .header-actions {
          display: flex; gap: 1rem; flex-wrap: wrap;
        }
        .filter-select {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 0.5rem; padding: 0.5rem 1rem;
          color: var(--text-main); font-size: 0.875rem;
        }
        .search-box {
          display: flex; align-items: center; gap: 0.5rem;
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 0.5rem; padding: 0.5rem 1rem;
        }
        .search-input {
          background: transparent; border: none; outline: none;
          color: var(--text-main); font-size: 0.875rem; width: 180px;
        }
        .feedback-bar {
          padding: 0.75rem 1rem; border-radius: 0.5rem;
          margin-bottom: 1rem; font-size: 0.875rem; font-weight: 500;
        }
        .feedback-success { background: rgba(16,185,129,0.15); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.3); }
        .feedback-error { background: rgba(239,68,68,0.15); color: #fca5a5; border: 1px solid rgba(239,68,68,0.3); }
        .empty-state {
          text-align: center; padding: 4rem 2rem;
          color: var(--text-muted);
        }
        .athletes-table-wrapper {
          background: var(--bg-card); border: 1px solid var(--border);
          border-radius: 1rem; overflow: auto;
        }
        .athletes-table {
          width: 100%; border-collapse: collapse; font-size: 0.875rem;
        }
        .athletes-table th {
          padding: 0.875rem 1rem; text-align: left;
          font-size: 0.75rem; font-weight: 600; text-transform: uppercase;
          letter-spacing: 0.05em; color: var(--text-muted);
          border-bottom: 1px solid var(--border);
        }
        .athletes-table td {
          padding: 0.875rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.04);
          color: var(--text-main); vertical-align: middle;
        }
        .athletes-table tr:last-child td { border-bottom: none; }
        .athletes-table tr:hover td { background: rgba(255,255,255,0.02); }
        .editing-row td { background: rgba(16,185,129,0.05) !important; }
        .athlete-name { font-weight: 600; }
        .text-center { text-align: center; }
        .text-muted { color: var(--text-muted); }
        .belt-chip { display: flex; align-items: center; gap: 0.5rem; }
        .belt-dot {
          width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0;
        }
        .role-pill {
          padding: 0.2rem 0.6rem; border-radius: 9999px;
          font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
        }
        .role-admin { background: rgba(239,68,68,0.15); color: #fca5a5; }
        .role-professor { background: rgba(245,158,11,0.15); color: #fcd34d; }
        .role-atleta { background: rgba(16,185,129,0.15); color: #6ee7b7; }
        .table-input {
          background: var(--bg-dark); border: 1px solid var(--border);
          border-radius: 0.375rem; padding: 0.375rem 0.5rem;
          color: var(--text-main); font-size: 0.875rem; width: 100%; min-width: 100px;
        }
        .table-input-sm { min-width: 60px; width: 70px; }
        .table-select {
          background: var(--bg-dark); border: 1px solid var(--border);
          border-radius: 0.375rem; padding: 0.375rem 0.5rem;
          color: var(--text-main); font-size: 0.875rem;
        }
        .btn-icon {
          width: 32px; height: 32px; border-radius: 0.5rem;
          display: inline-flex; align-items: center; justify-content: center;
          cursor: pointer; transition: all 0.2s;
        }
        .btn-edit { background: rgba(16,185,129,0.1); color: var(--primary); }
        .btn-edit:hover { background: rgba(16,185,129,0.25); }
        .btn-save { background: rgba(16,185,129,0.2); color: #6ee7b7; }
        .btn-save:hover { background: rgba(16,185,129,0.4); }
        .btn-cancel { background: rgba(239,68,68,0.1); color: #fca5a5; }
        .btn-cancel:hover { background: rgba(239,68,68,0.25); }
        @media (max-width: 768px) {
          .search-input { width: 160px; }
        }
      `}</style>
        </div>
    );
}
