import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Users, Calendar, Clock, Trash2, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Classes() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [classes, setClasses] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [capacity, setCapacity] = useState('30');

    const isAdmin = profile?.role === 'Admin' || profile?.role === 'Professor';

    useEffect(() => {
        fetchClasses();
    }, []);

    const fetchClasses = async () => {
        setLoading(true);
        // Aqui numa app real juntaríamos informações sobre reservas ou vagas disponíveis.
        // Para simplificar, buscamos aulas ordenadas por data.
        const { data, error: _error } = await supabase
            .from('classes')
            .select('*, professor_id(full_name)')
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        if (data) setClasses(data);
        setLoading(false);
    };

    const handleCreateClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;

        const { error } = await supabase.from('classes').insert([
            {
                title,
                date,
                start_time: startTime,
                end_time: endTime,
                capacity: parseInt(capacity),
                professor_id: profile.id
            }
        ]);

        if (!error) {
            setShowModal(false);
            setTitle('');
            setDate('');
            setStartTime('');
            setEndTime('');
            fetchClasses();
        } else {
            alert('Erro ao criar aula: ' + error.message);
        }
    };

    const handleBooking = async (classId: string) => {
        // Inscrever o utilizador na aula
        const { error } = await supabase.from('class_bookings').insert([
            { class_id: classId, user_id: profile.id, status: 'Marcado' }
        ]);

        if (error) {
            if (error.code === '23505') {
                alert('Já estás inscrito nesta aula.');
            } else {
                alert('Erro ao inscrever: ' + error.message);
            }
        } else {
            alert('Inscrição confirmada!');
            // Atualizar vagas (simulado)
        }
    };

    const handleDeleteClass = async (classId: string) => {
        if (!confirm('Eliminar esta aula?')) return;
        const { error } = await supabase.from('classes').delete().eq('id', classId);
        if (!error) fetchClasses();
    };

    return (
        <div className="classes-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title">{isAdmin ? 'Gestão de Aulas' : 'Aulas Disponíveis'}</h1>
                    <p className="text-muted">Planeia a tua semana de treinos no tatame.</p>
                </div>
                {isAdmin && (
                    <button className="btn-primary w-auto" onClick={() => setShowModal(true)}>
                        <Plus size={20} /> Nova Aula
                    </button>
                )}
            </div>

            {loading ? (
                <p className="text-muted">A carregar aulas...</p>
            ) : classes.length === 0 ? (
                <div className="empty-state">
                    <Calendar size={48} className="text-muted" style={{ marginBottom: '1rem' }} />
                    <p className="text-muted">Não há aulas programadas para os próximos dias.</p>
                </div>
            ) : (
                <div className="classes-grid">
                    {classes.map(cls => (
                        <div key={cls.id} className="class-card">
                            <div className="class-header">
                                <h3>{cls.title}</h3>
                                {isAdmin && (
                                    <button onClick={() => handleDeleteClass(cls.id)} className="btn-icon danger">
                                        <Trash2 size={18} />
                                    </button>
                                )}
                            </div>
                            <div className="class-details">
                                <p><Calendar size={16} /> {cls.date}</p>
                                <p><Clock size={16} /> {cls.start_time.substring(0, 5)} - {cls.end_time.substring(0, 5)}</p>
                                <p><Users size={16} /> Vagas: {cls.capacity}</p>
                            </div>

                            {!isAdmin && (
                                <button
                                    className="btn-primary mt-4 w-full"
                                    onClick={() => handleBooking(cls.id)}
                                >
                                    <CheckCircle size={18} /> Inscrever-me
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && isAdmin && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in">
                        <h2>Agendar Nova Aula</h2>
                        <form onSubmit={handleCreateClass}>
                            <div className="form-group">
                                <label className="form-label">Título da Aula</label>
                                <input type="text" className="form-input" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Ex: Jiu-Jitsu Iniciantes" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Data</label>
                                <input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} required />
                            </div>
                            <div style={{ display: 'flex', gap: '1rem' }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Início</label>
                                    <input type="time" className="form-input" value={startTime} onChange={e => setStartTime(e.target.value)} required />
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Fim</label>
                                    <input type="time" className="form-input" value={endTime} onChange={e => setEndTime(e.target.value)} required />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Capacidade Máxima</label>
                                <input type="number" className="form-input" value={capacity} onChange={e => setCapacity(e.target.value)} required min="1" />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                                <button type="submit" className="btn-primary w-auto">Guardar Aula</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 2rem;
        }
        .text-muted {
          color: var(--text-muted);
        }
        .w-auto { width: auto; }
        .w-full { width: 100%; }
        .mt-4 { margin-top: 1rem; }
        
        .empty-state {
          background-color: var(--bg-card);
          padding: 4rem 2rem;
          border-radius: 1rem;
          text-align: center;
          border: 1px dashed var(--border);
        }

        .classes-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
        }

        .class-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1rem;
          padding: 1.5rem;
          transition: transform 0.2s, box-shadow 0.2s;
        }

        .class-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5);
          border-color: rgba(16, 185, 129, 0.3);
        }

        .class-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 1rem;
        }

        .class-header h3 {
          font-size: 1.125rem;
          color: white;
          font-weight: 600;
        }

        .btn-icon {
          color: var(--text-muted);
          padding: 0.25rem;
        }
        .btn-icon:hover.danger {
          color: var(--danger);
        }

        .class-details p {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-bottom: 0.5rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        /* Modal */
        .modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 50;
          padding: 1rem;
        }

        .modal-content {
          background-color: var(--bg-card);
          padding: 2rem;
          border-radius: 1rem;
          width: 100%;
          max-width: 500px;
          border: 1px solid var(--border);
        }

        .modal-content h2 {
          color: white;
          margin-bottom: 1.5rem;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }

        .btn-secondary {
          padding: 0.75rem 1.5rem;
          color: var(--text-main);
          font-weight: 500;
          border-radius: 0.5rem;
        }
        .btn-secondary:hover {
          background-color: rgba(255, 255, 255, 0.05);
        }
      `}</style>
        </div>
    );
}
