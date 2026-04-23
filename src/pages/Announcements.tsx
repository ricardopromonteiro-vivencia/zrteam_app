import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Megaphone, Plus, Trash2, Calendar, User, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { isProfessor } from '../lib/roles';

export default function Announcements() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [announcements, setAnnouncements] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [type, setType] = useState('general');
    const [schoolId, setSchoolId] = useState<string | null>(profile?.school_id || null);
    const [schools, setSchools] = useState<any[]>([]);

    const isAdmin = profile?.role === 'Admin' || isProfessor(profile?.role);

    useEffect(() => {
        fetchAnnouncements();
        if (isAdmin) {
            fetchSchools();
        }
    }, [profile]);

    const [authors, setAuthors] = useState<Record<string, string>>({});

    const fetchAnnouncements = async () => {
        setLoading(true);
        let query = supabase
            .from('announcements')
            .select('*, school:schools(name)')
            .order('created_at', { ascending: false });

        if (!isAdmin) {
            query = query.or(`target_user_id.is.null,target_user_id.eq.${profile.id}`);
        }

        const { data } = await query;

        if (data) {
            setAnnouncements(data);
            // Resolver nomes dos autores separadamente (evita join sem FK)
            const authorIds = [...new Set(data.map((a: any) => a.author_id).filter(Boolean))];
            if (authorIds.length > 0) {
                const { data: profilesData } = await supabase
                    .from('profiles')
                    .select('id, full_name')
                    .in('id', authorIds);
                if (profilesData) {
                    const map: Record<string, string> = {};
                    profilesData.forEach((p: any) => { map[p.id] = p.full_name; });
                    setAuthors(map);
                }
            }
        }
        setLoading(false);
    };

    const fetchSchools = async () => {
        const { data } = await supabase.from('schools').select('id, name').order('order_index', { ascending: true }).order('name');
        if (data) setSchools(data);
    };

    const handleCreateAnnouncement = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;

        const { error } = await supabase.from('announcements').insert([
            {
                title,
                content,
                type,
                author_id: profile.id,
                school_id: profile.role === 'Admin' ? (schoolId === 'all' ? null : schoolId) : profile.school_id
            }
        ]);

        if (!error) {
            setShowModal(false);
            setTitle('');
            setContent('');
            fetchAnnouncements();
        } else {
            alert('Erro ao criar aviso: ' + error.message);
        }
    };

    const handleDeleteAnnouncement = async (id: string) => {
        if (!confirm('Eliminar este aviso?')) return;
        const { error } = await supabase.from('announcements').delete().eq('id', id);
        if (!error) fetchAnnouncements();
    };

    return (
        <div className="announcements-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Avisos e Notícias</h1>
                    <p className="text-muted">Fica a par das últimas novidades da academia.</p>
                </div>
                {isAdmin && (
                    <button className="btn-primary w-auto" onClick={() => setShowModal(v => !v)}>
                        <Plus size={20} /> {showModal ? 'Cancelar' : 'Novo Aviso'}
                    </button>
                )}
            </div>

            {/* Formulário inline no topo */}
            {showModal && (
                <div className="ann-form-inline animate-fade-in">
                    <h2 style={{ marginBottom: '1.25rem', fontSize: '1.1rem', color: 'white' }}>Criar Novo Aviso</h2>
                    <form onSubmit={handleCreateAnnouncement}>
                        <div className="form-group">
                            <label className="form-label">Título</label>
                            <input
                                type="text"
                                className="form-input"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                                placeholder="Ex: Treino Especial de Sábado"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Mensagem</label>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '120px' }}
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                required
                                placeholder="Escreve aqui o conteúdo do aviso..."
                            />
                        </div>
                        {profile.role === 'Admin' && (
                            <div className="form-group">
                                <label className="form-label">Escola</label>
                                <select
                                    className="form-input"
                                    value={schoolId || 'all'}
                                    onChange={e => setSchoolId(e.target.value === 'all' ? null : e.target.value)}
                                >
                                    <option value="all">Todas as Escolas (Global)</option>
                                    {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="form-group">
                            <label className="form-label">Tipo de Aviso</label>
                            <select
                                className="form-input"
                                value={type}
                                onChange={e => setType(e.target.value)}
                            >
                                <option value="general">Geral</option>
                                <option value="class_update">Atualização de Aula</option>
                                <option value="system">Sistema</option>
                            </select>
                        </div>
                        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                            <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                            <button type="submit" className="btn-primary w-auto">Publicar Aviso</button>
                        </div>
                    </form>
                </div>
            )}

            {loading ? (
                <p className="text-muted">A carregar avisos...</p>
            ) : announcements.length === 0 ? (
                <div className="empty-state">
                    <Megaphone size={48} className="text-muted" style={{ marginBottom: '1rem' }} />
                    <p className="text-muted">Ainda não há avisos para mostrar.</p>
                </div>
            ) : (
                <div className="announcements-list">
                    {announcements.map(ann => (
                        <div key={ann.id} className={`announcement-card ${ann.type}`}>
                            <div className="ann-header">
                                <div className="ann-title-group">
                                    <span className={`ann-badge ${ann.type}`}>
                                        {ann.type === 'class_update' ? 'Aula' : ann.type === 'system' ? 'Sistema' : 'Geral'}
                                    </span>
                                    <h3>{ann.title}</h3>
                                </div>
                                {isAdmin && (ann.author_id === profile.id || profile.role === 'Admin') && (
                                    <button onClick={() => handleDeleteAnnouncement(ann.id)} className="btn-icon danger">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                            <div className="ann-content">
                                {ann.content.split('\n').map((line: string, i: number) => (
                                    <p key={i}>{line}</p>
                                ))}
                            </div>
                            <div className="ann-footer">
                                <span><Calendar size={14} /> {new Date(ann.created_at).toLocaleDateString('pt-PT')}</span>
                                <span><User size={14} /> {authors[ann.author_id] || '—'}</span>
                                {ann.school && <span><Building2 size={14} /> {ann.school.name}</span>}
                                {!ann.school && <span><Building2 size={14} /> Global</span>}
                            </div>
                        </div>
                    ))}
                </div>
            )}



            <style>{`
                .announcements-page { padding-bottom: 2rem; }
                .ann-form-inline {
                    background: var(--bg-card);
                    border: 1px solid rgba(16,185,129,0.3);
                    border-radius: 1rem;
                    padding: 1.5rem;
                    margin-bottom: 1.5rem;
                    max-width: 800px;
                    margin-left: auto;
                    margin-right: auto;
                }
                .announcements-list { display: flex; flex-direction: column; gap: 1.5rem; max-width: 800px; margin: 0 auto; }
                
                .announcement-card {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 1rem;
                    padding: 1.5rem;
                    border-left: 4px solid var(--primary);
                    transition: all 0.2s;
                }
                .announcement-card.class_update { border-left-color: #f59e0b; }
                .announcement-card.system { border-left-color: #3b82f6; }
                
                .announcement-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3); border-color: rgba(16, 185, 129, 0.3); }

                .ann-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; }
                .ann-title-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .ann-title-group h3 { font-size: 1.25rem; color: white; font-weight: 700; margin: 0; }
                
                .ann-badge {
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    padding: 0.2rem 0.5rem;
                    border-radius: 4px;
                    width: fit-content;
                    background: rgba(16, 185, 129, 0.1);
                    color: var(--primary);
                }
                .ann-badge.class_update { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
                .ann-badge.system { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }

                .ann-content { color: var(--text-muted); line-height: 1.6; font-size: 0.95rem; margin-bottom: 1.5rem; }
                .ann-content p { margin-bottom: 0.5rem; }

                .ann-footer {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255,255,255,0.05);
                    font-size: 0.8rem;
                    color: var(--text-muted);
                }
                .ann-footer span { display: flex; align-items: center; gap: 0.5rem; }

                .empty-state { text-align: center; padding: 4rem 2rem; background: var(--bg-card); border-radius: 1rem; border: 1px dashed var(--border); }
                
                @media (max-width: 640px) {
                    .ann-footer { gap: 1rem; }
                }
            `}</style>
        </div>
    );
}
