import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Building2, Plus, Edit2, Trash2, CheckCircle, HelpCircle, User } from 'lucide-react';

export default function Schools() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [schools, setSchools] = useState<any[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSchool, setEditingSchool] = useState<any>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    // Apenas Admin pode aceder
    if (profile?.role !== 'Admin') {
        return (
            <div style={{ padding: '2rem', color: 'var(--danger)' }}>
                Acesso restrito. Apenas Administradores podem gerir escolas.
            </div>
        );
    }

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const { data: schoolsData } = await supabase
            .from('schools')
            .select('*, head_professor:head_professor_id(id, full_name)')
            .order('name');
        if (schoolsData) setSchools(schoolsData);

        const { data: profsData } = await supabase
            .from('profiles')
            .select('id, full_name')
            .in('role', ['Professor', 'Admin'])
            .order('full_name');
        if (profsData) setProfessors(profsData);

        setLoading(false);
    }

    const handleDelete = async (id: string) => {
        if (confirmDelete === id) {
            const { error } = await supabase.from('schools').delete().eq('id', id);
            if (!error) loadData();
            setConfirmDelete(null);
        } else {
            setConfirmDelete(id);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const schoolData = {
            name: editingSchool.name,
            head_professor_id: editingSchool.head_professor_id || null
        };

        let error;
        if (editingSchool.id) {
            const { error: updateError } = await supabase
                .from('schools')
                .update(schoolData)
                .eq('id', editingSchool.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('schools')
                .insert(schoolData);
            error = insertError;
        }

        if (!error) {
            setEditingSchool(null);
            loadData();
        } else {
            alert('Erro ao guardar: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="schools-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Gestão de Escolas</h1>
                    <p className="page-subtitle">Gere as academias ZR Team e os professores responsáveis.</p>
                </div>
                <button className="btn-primary" onClick={() => setEditingSchool({ name: '', head_professor_id: '' })}>
                    <Plus size={20} /> Nova Escola
                </button>
            </header>

            {loading && !editingSchool && <p className="loading-text">A carregar escolas...</p>}

            <div className="schools-grid">
                {schools.map(school => (
                    <div key={school.id} className="school-card">
                        <div className="school-header">
                            <div className="school-icon"><Building2 size={24} /></div>
                            <h3>{school.name}</h3>
                        </div>
                        <div className="school-details">
                            <p>
                                <User size={14} />
                                {school.head_professor?.full_name || <span style={{ color: 'var(--danger)', fontSize: '0.75rem' }}>Sem professor responsável</span>}
                            </p>
                        </div>
                        <div className="school-actions">
                            <button className="icon-btn edit" onClick={() => setEditingSchool({
                                ...school,
                                head_professor_id: school.head_professor_id || ''
                            })}>
                                <Edit2 size={18} />
                            </button>
                            <button
                                className={`icon-btn delete ${confirmDelete === school.id ? 'confirming' : ''}`}
                                onClick={() => handleDelete(school.id)}
                            >
                                {confirmDelete === school.id ? <CheckCircle size={18} /> : <Trash2 size={18} />}
                            </button>
                            {confirmDelete === school.id && (
                                <button className="icon-btn cancel" onClick={() => setConfirmDelete(null)}>
                                    <HelpCircle size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Escola */}
            {editingSchool && (
                <div className="modal-overlay">
                    <div className="modal-content school-modal animate-fade-in">
                        <h2>{editingSchool.id ? 'Editar Escola' : 'Nova Escola'}</h2>
                        <form onSubmit={handleSave} className="school-form">
                            <div className="form-group">
                                <label className="form-label">Nome da Academia</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={editingSchool.name}
                                    onChange={e => setEditingSchool({ ...editingSchool, name: e.target.value })}
                                    required
                                    placeholder="Ex: ZR Team Fafe"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Professor Responsável</label>
                                <select
                                    className="form-input"
                                    value={editingSchool.head_professor_id}
                                    onChange={e => setEditingSchool({ ...editingSchool, head_professor_id: e.target.value })}
                                >
                                    <option value="">— Sem responsável —</option>
                                    {professors.map(p => (
                                        <option key={p.id} value={p.id}>{p.full_name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setEditingSchool(null)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? 'A guardar...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .schools-page { max-width: 900px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
        .page-subtitle { color: var(--text-muted); font-size: 0.875rem; margin-top: 0.25rem; }
        .loading-text { text-align: center; color: var(--primary); margin-top: 2rem; }

        .schools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .school-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1rem;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
          transition: transform 0.2s, border-color 0.2s;
        }
        .school-card:hover { transform: translateY(-3px); border-color: var(--primary); }
        .school-header { display: flex; align-items: center; gap: 0.75rem; }
        .school-header h3 { font-size: 1rem; font-weight: 700; color: white; }
        .school-icon {
          color: var(--primary);
          background: rgba(16, 185, 129, 0.1);
          padding: 0.5rem;
          border-radius: 0.75rem;
          flex-shrink: 0;
        }
        .school-details { font-size: 0.875rem; color: var(--text-muted); }
        .school-details p { display: flex; align-items: center; gap: 0.5rem; }
        .school-actions {
          display: flex; gap: 0.5rem; margin-top: 0.5rem; padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .icon-btn {
          background: none; border: 1px solid var(--border); padding: 0.5rem; border-radius: 0.5rem;
          cursor: pointer; color: var(--text-muted); transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .icon-btn.edit:hover { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: #3b82f6; }
        .icon-btn.delete:hover { background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: var(--danger); }
        .icon-btn.delete.confirming { background: var(--danger); color: white; border-color: var(--danger); }

        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
        }
        .modal-content.school-modal {
          background: var(--bg-card); border: 1px solid var(--border);
          padding: 2rem; border-radius: 1.5rem; width: 100%; max-width: 480px;
        }
        .modal-content h2 { color: white; margin-bottom: 1.5rem; }
        .school-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-label { font-size: 0.875rem; color: var(--text-muted); font-weight: 500; }
        .form-input {
          background: rgba(255,255,255,0.05); border: 1px solid var(--border);
          border-radius: 0.75rem; padding: 0.75rem 1rem; color: white; width: 100%;
        }
        .form-input option { background: #1a1a1a; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 0.5rem; }

        @media (max-width: 480px) {
          .schools-grid { grid-template-columns: 1fr; }
        }
      `}</style>
        </div>
    );
}
