import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Users, Calendar, Clock, Trash2, CheckCircle, Info, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Classes() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [classes, setClasses] = useState<any[]>([]);
    const [userBookings, setUserBookings] = useState<string[]>([]);
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
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // 1. Buscar aulas com contagem de reservas
        const { data: classData } = await supabase
            .from('classes')
            .select(`
                *,
                professor_id(full_name),
                class_bookings(count)
            `)
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        // 2. Buscar marcações do utilizador para saber em quais está inscrito
        const { data: bookingData } = await supabase
            .from('class_bookings')
            .select('class_id')
            .eq('user_id', profile.id);

        if (classData) setClasses(classData);
        if (bookingData) setUserBookings(bookingData.map(b => b.class_id));

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
            fetchData();
        } else {
            alert('Erro ao criar aula: ' + error.message);
        }
    };

    const handleBooking = async (classId: string) => {
        const isEnrolled = userBookings.includes(classId);

        if (isEnrolled) {
            // Cancelar inscrição
            if (!confirm('Queres desmarcar esta aula?')) return;

            const { error } = await supabase
                .from('class_bookings')
                .delete()
                .eq('class_id', classId)
                .eq('user_id', profile.id);

            if (error) {
                alert('Erro ao desmarcar: ' + error.message);
            } else {
                setUserBookings(prev => prev.filter(id => id !== classId));
                fetchData(); // Recarregar para atualizar vagas
            }
        } else {
            // Inscrever
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
                setUserBookings(prev => [...prev, classId]);
                fetchData(); // Recarregar para atualizar vagas
            }
        }
    };

    const getCalendarLinks = (cls: any) => {
        const title = encodeURIComponent(`Treino de Jiu Jitsu: ${cls.title}`);
        const dateStr = cls.date.replace(/-/g, '');
        const start = cls.start_time.replace(/:/g, '') + '00';
        const end = cls.end_time.replace(/:/g, '') + '00';
        const location = encodeURIComponent('Academia Zr Team');

        return {
            google: `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dateStr}T${start}/${dateStr}T${end}&details=Treino+de+Jiu+Jitsu&location=${location}`,
            outlook: `https://outlook.live.com/calendar/0/deeplink/compose?path=/calendar/action/compose&rru=addevent&subject=${title}&startdt=${cls.date}T${cls.start_time}&enddt=${cls.date}T${cls.end_time}&body=Treino+de+Jiu+Jitsu&location=${location}`
        };
    };

    const handleDeleteClass = async (classId: string) => {
        if (!confirm('Eliminar esta aula?')) return;
        const { error } = await supabase.from('classes').delete().eq('id', classId);
        if (!error) fetchData();
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
                    {classes.map(cls => {
                        const isEnrolled = userBookings.includes(cls.id);
                        return (
                            <div key={cls.id} className={`class-card ${isEnrolled ? 'enrolled' : ''}`}>
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
                                    <p>
                                        <Users size={16} /> Vagas: {cls.capacity - (cls.class_bookings?.[0]?.count || 0)} / {cls.capacity}
                                    </p>
                                </div>

                                {!isAdmin && (
                                    <button
                                        className={`btn-booking mt-4 w-full ${isEnrolled ? 'btn-enrolled' : 'btn-primary'}`}
                                        onClick={() => handleBooking(cls.id)}
                                    >
                                        {isEnrolled ? (
                                            <><CheckCircle size={18} /> Inscrito (Desmarcar)</>
                                        ) : (
                                            <><Plus size={18} /> Inscrever-me</>
                                        )}
                                    </button>
                                )}

                                {isEnrolled && (
                                    <div className="enrolled-footer">
                                        <div className="enrolled-badge">
                                            <Info size={12} /> Inscrito
                                        </div>
                                        <div className="calendar-dropdown">
                                            <button className="btn-calendar-mini">
                                                <ExternalLink size={12} /> Calendário
                                            </button>
                                            <div className="calendar-menu">
                                                {(() => {
                                                    const links = getCalendarLinks(cls);
                                                    return (
                                                        <>
                                                            <a href={links.google} target="_blank" rel="noreferrer">Google</a>
                                                            <a href={links.outlook} target="_blank" rel="noreferrer">Outlook</a>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
                .page-header { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem; }
                .text-muted { color: var(--text-muted); }
                .w-auto { width: auto; }
                .w-full { width: 100%; }
                .mt-4 { margin-top: 1rem; }
                
                .empty-state { background-color: var(--bg-card); padding: 4rem 2rem; border-radius: 1rem; text-align: center; border: 1px dashed var(--border); }
                .classes-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; }
                
                .class-card { 
                    background-color: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; 
                    transition: all 0.2s; position: relative; overflow: hidden;
                }
                .class-card.enrolled { border-color: var(--primary); background: rgba(16, 185, 129, 0.05); }
                .class-card:hover { transform: translateY(-2px); box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); border-color: rgba(16, 185, 129, 0.3); }
                .class-card.enrolled:hover { border-color: var(--primary); }

                .class-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 1rem; }
                .class-header h3 { font-size: 1.125rem; color: white; font-weight: 600; }

                .class-details p { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.875rem; }

                .btn-booking { 
                    display: flex; align-items: center; justify-content: center; gap: 0.75rem; 
                    padding: 0.75rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
                }
                .btn-enrolled { background: rgba(16, 185, 129, 0.2); color: var(--primary); border: 1px solid var(--primary); }
                .btn-enrolled:hover { background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: var(--danger); }

                .enrolled-footer {
                    margin-top: 1rem;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    background: rgba(16, 185, 129, 0.1);
                    padding: 0.5rem 0.75rem;
                    border-radius: 0.5rem;
                }
                .enrolled-badge { 
                    font-size: 0.75rem; color: var(--primary); 
                    display: flex; align-items: center; gap: 0.375rem;
                }
                .calendar-dropdown { position: relative; }
                .btn-calendar-mini {
                    background: transparent; border: none; color: var(--text-muted);
                    font-size: 0.7rem; display: flex; align-items: center; gap: 0.25rem;
                    cursor: pointer; padding: 0.25rem;
                }
                .btn-calendar-mini:hover { color: var(--primary); }
                .calendar-menu {
                    display: none; position: absolute; right: 0; bottom: 100%;
                    background: var(--bg-card); border: 1px solid var(--border);
                    border-radius: 0.4rem; min-width: 100px; z-index: 10; padding: 0.25rem;
                }
                .calendar-dropdown:hover .calendar-menu { display: flex; flex-direction: column; }
                .calendar-menu a {
                    font-size: 0.7rem; color: var(--text-muted); text-decoration: none;
                    padding: 0.4rem 0.6rem; border-radius: 0.25rem;
                }
                .calendar-menu a:hover { background: rgba(255,255,255,0.05); color: var(--primary); }

                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.75); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 1rem; }
                .modal-content { background-color: var(--bg-card); padding: 2rem; border-radius: 1rem; width: 100%; max-width: 500px; border: 1px solid var(--border); }
                .modal-content h2 { color: white; margin-bottom: 1.5rem; }
                .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; }
            `}</style>
        </div>
    );
}
