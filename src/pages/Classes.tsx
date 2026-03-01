import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Users, Calendar, Clock, Trash2, CheckCircle, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function Classes() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [classes, setClasses] = useState<any[]>([]);
    const [userBookings, setUserBookings] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingClass, setEditingClass] = useState<any>(null);
    const [showBookingsModal, setShowBookingsModal] = useState(false);
    const [selectedClassBookings, setSelectedClassBookings] = useState<any[]>([]);
    const [selectedClassTitle, setSelectedClassTitle] = useState('');
    const [loadingBookings, setLoadingBookings] = useState(false);
    const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

    const DAYS_OF_WEEK = [
        { name: 'Seg', fullName: 'Segunda-feira', id: 1 },
        { name: 'Ter', fullName: 'Terça-feira', id: 2 },
        { name: 'Qua', fullName: 'Quarta-feira', id: 3 },
        { name: 'Qui', fullName: 'Quinta-feira', id: 4 },
        { name: 'Sex', fullName: 'Sexta-feira', id: 5 },
        { name: 'Sáb', fullName: 'Sábado', id: 6 },
        { name: 'Dom', fullName: 'Domingo', id: 0 }
    ];

    const getTargetDate = (dayId: number) => {
        const today = new Date();
        const currentDay = today.getDay();
        let diff = dayId - currentDay;
        if (diff < 0) diff += 7;
        const result = new Date(today);
        result.setDate(today.getDate() + diff);
        return result.toISOString().split('T')[0];
    };

    // Form State
    const [title, setTitle] = useState('');
    const [date, setDate] = useState('');
    const [startTime, setStartTime] = useState('');
    const [endTime, setEndTime] = useState('');
    const [capacity, setCapacity] = useState('30');
    const [isRecurring, setIsRecurring] = useState(false);
    const [selectedSchoolId, setSelectedSchoolId] = useState('');
    const [selectedProfessorId, setSelectedProfessorId] = useState('');
    const [schools, setSchools] = useState<any[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);

    const isAdmin = profile?.role === 'Admin' || profile?.role === 'Professor';

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);

        // 1. Buscar escolas e professores (para o form)
        if (isAdmin) {
            const { data: schoolsData } = await supabase.from('schools').select('id, name').order('name');
            if (schoolsData) setSchools(schoolsData);

            const { data: profsData } = await supabase
                .from('profiles')
                .select('id, full_name, role, school_id')
                .in('role', ['Professor', 'Admin'])
                .order('full_name');
            if (profsData) setProfessors(profsData);
        }

        // 2. Buscar aulas com contagem de reservas
        let query = supabase
            .from('classes')
            .select('*, professor_id:profiles(id, full_name), class_bookings(count)');

        // Restrição de visibilidade:
        // Se for Atleta: ver apenas aulas da sua escola
        // Se for Professor: ver apenas aulas da sua escola
        // Se for Admin: ver todas
        if (profile?.role !== 'Admin') {
            if (profile?.school_id) {
                query = query.eq('school_id', profile.school_id);
            } else {
                // Se não tiver escola, vê as órfãs (ou nenhuma, dependendo da política)
                query = query.is('school_id', null);
            }
        }

        const { data: classData } = await query
            .order('date', { ascending: true })
            .order('start_time', { ascending: true });

        // 3. Buscar marcações do utilizador
        const { data: bookingData } = await supabase
            .from('class_bookings')
            .select('class_id')
            .eq('user_id', profile.id);

        if (classData) setClasses(classData);
        if (bookingData) setUserBookings(bookingData.map(b => b.class_id));

        setLoading(false);
    };

    const handleSubmitClass = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isAdmin) return;

        // Determinar escola e professor
        const finalSchoolId = profile?.role === 'Admin' ? selectedSchoolId : profile.school_id;
        const finalProfessorId = profile?.role === 'Admin' ? selectedProfessorId : (editingClass ? selectedProfessorId : profile.id);

        if (!finalSchoolId && profile?.role === 'Admin') {
            alert('Por favor seleciona uma escola.');
            return;
        }

        const classData: any = {
            title,
            date,
            start_time: startTime,
            end_time: endTime,
            capacity: parseInt(capacity),
            professor_id: finalProfessorId || profile.id,
            school_id: finalSchoolId || null,
            is_recurring: isRecurring
        };

        let error;
        if (editingClass) {
            const { error: updateError } = await supabase.from('classes').update(classData).eq('id', editingClass.id);
            error = updateError;

            // Criar aviso automático se houver marcações
            const bookingCount = editingClass.class_bookings?.[0]?.count || 0;
            if (!error && bookingCount > 0) {
                await supabase.from('announcements').insert([{
                    title: `Alteração na aula: ${classData.title}`,
                    content: `A aula de ${new Date(classData.date).toLocaleDateString('pt-PT')} das ${classData.start_time.substring(0, 5)} foi alterada. Por favor verifica os novos detalhes.`,
                    type: 'class_update',
                    author_id: profile.id,
                    school_id: classData.school_id
                }]);
            }
        } else {
            const { error: insertError } = await supabase.from('classes').insert([classData]);
            error = insertError;
        }

        if (!error) {
            setShowModal(false);
            setEditingClass(null);
            resetForm();
            fetchData();
        } else {
            alert('Erro ao guardar aula: ' + error.message);
        }
    };

    const resetForm = () => {
        setTitle('');
        setDate('');
        setStartTime('');
        setEndTime('');
        setIsRecurring(false);
        setCapacity('30');
        setSelectedSchoolId(profile?.role === 'Admin' ? '' : profile?.school_id || '');
        setSelectedProfessorId(profile?.role === 'Admin' ? '' : profile?.id || '');
    };

    const handleOpenCreateModal = () => {
        setEditingClass(null);
        resetForm();
        setShowModal(true);
    };

    const handleOpenEditModal = (cls: any) => {
        setEditingClass(cls);
        setTitle(cls.title);
        setDate(cls.date);
        setStartTime(cls.start_time);
        setEndTime(cls.end_time);
        setCapacity(cls.capacity.toString());
        setIsRecurring(cls.is_recurring);
        setSelectedSchoolId(cls.school_id || '');
        setSelectedProfessorId(cls.professor_id?.id || cls.professor_id || '');
        setShowModal(true);
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


    const handleViewBookings = async (cls: any) => {
        setSelectedClassTitle(cls.title);
        setShowBookingsModal(true);
        setLoadingBookings(true);

        const { data, error } = await supabase
            .from('class_bookings')
            .select(`
                id,
                status,
                profiles (
                    full_name,
                    belt,
                    degrees
                )
            `)
            .eq('class_id', cls.id)
            .order('created_at');

        if (data) {
            setSelectedClassBookings(data);
        } else if (error) {
            console.error('Erro ao buscar inscritos:', error);
        }
        setLoadingBookings(false);
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
                    <button className="btn-primary w-auto" onClick={handleOpenCreateModal}>
                        <Plus size={20} /> Nova Aula
                    </button>
                )}
            </div>

            <div className="day-selector">
                {DAYS_OF_WEEK.map(day => (
                    <button
                        key={day.id}
                        className={`day-btn ${selectedDay === day.id ? 'active' : ''}`}
                        onClick={() => setSelectedDay(day.id)}
                    >
                        <span className="day-short">{day.name}</span>
                        <span className="day-date">{getTargetDate(day.id).split('-').reverse().slice(0, 2).join('/')}</span>
                    </button>
                ))}
            </div>

            {loading ? (
                <p className="text-muted">A carregar aulas...</p>
            ) : (
                <div className="classes-grid animate-fade-in">
                    {(() => {
                        const targetDate = getTargetDate(selectedDay);
                        const filteredClasses = classes.filter(cls => cls.date === targetDate);

                        if (filteredClasses.length === 0) {
                            return (
                                <div className="empty-state">
                                    <Calendar size={48} className="text-muted" style={{ marginBottom: '1rem' }} />
                                    <p className="text-muted">Não há aulas para {DAYS_OF_WEEK.find(d => d.id === selectedDay)?.fullName}.</p>
                                </div>
                            );
                        }

                        return filteredClasses.map(cls => {
                            const isEnrolled = userBookings.includes(cls.id);
                            return (
                                <div key={cls.id} className={`class-card ${isEnrolled ? 'enrolled' : ''}`}>
                                    <div className="class-header">
                                        <h3>{cls.title}</h3>
                                        {isAdmin && (
                                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                <button onClick={() => handleOpenEditModal(cls)} className="btn-icon">
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDeleteClass(cls.id)} className="btn-icon danger">
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div className="class-details">
                                        <p><Clock size={16} /> {cls.start_time.substring(0, 5)} - {cls.end_time.substring(0, 5)}</p>
                                        <p>
                                            <Users size={16} /> Vagas: {cls.capacity - (cls.class_bookings?.[0]?.count || 0)} / {cls.capacity}
                                        </p>
                                        <p>
                                            <Users size={16} /> Professor: {cls.professor_id?.full_name || '—'}
                                        </p>
                                        {cls.is_recurring && (
                                            <p className="text-primary" style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                                                <Calendar size={14} /> Aula Recorrente
                                            </p>
                                        )}
                                        {isAdmin && (
                                            <button
                                                onClick={() => handleViewBookings(cls)}
                                                className="btn-view-bookings"
                                                style={{ marginTop: '0.5rem', width: '100%', fontSize: '0.75rem', padding: '0.4rem' }}
                                            >
                                                Ver Inscritos
                                            </button>
                                        )}
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
                                </div>
                            );
                        });
                    })()}
                </div>
            )}

            {showBookingsModal && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in" style={{ maxWidth: '500px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h2 style={{ margin: 0 }}>Inscritos: {selectedClassTitle}</h2>
                            <button className="btn-icon" onClick={() => setShowBookingsModal(false)}>
                                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
                            </button>
                        </div>

                        {loadingBookings ? (
                            <p className="text-muted">A carregar...</p>
                        ) : selectedClassBookings.length === 0 ? (
                            <p className="text-muted" style={{ textAlign: 'center', padding: '1rem' }}>Ainda não há inscritos.</p>
                        ) : (
                            <div className="bookings-modal-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                {selectedClassBookings.map((b: any) => (
                                    <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{b.profiles?.full_name}</div>
                                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{b.profiles?.belt} | {b.profiles?.degrees} Grau(s)</div>
                                        </div>
                                        <div style={{ fontSize: '0.75rem', alignSelf: 'center' }}>
                                            <span className={`status-badge status-${b.status.toLowerCase()}`}>{b.status}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                        <div className="modal-actions" style={{ marginTop: '1.5rem' }}>
                            <button className="btn-primary" onClick={() => setShowBookingsModal(false)}>Fechar</button>
                        </div>
                    </div>
                </div>
            )}

            {showModal && isAdmin && (
                <div className="modal-overlay">
                    <div className="modal-content animate-fade-in">
                        <h2>{editingClass ? 'Editar Aula' : 'Agendar Nova Aula'}</h2>
                        <form onSubmit={handleSubmitClass}>
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
                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label className="form-label">Capacidade Máxima</label>
                                <input type="number" className="form-input" value={capacity} onChange={e => setCapacity(e.target.value)} required min="1" />
                            </div>

                            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', background: 'rgba(255,255,255,0.03)', padding: '0.75rem', borderRadius: '0.5rem', border: '1px solid var(--border)' }}>
                                    <input
                                        type="checkbox"
                                        checked={isRecurring}
                                        onChange={e => setIsRecurring(e.target.checked)}
                                        style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--primary)' }}
                                    />
                                    <span style={{ fontSize: '0.9rem', color: 'white' }}>Aula Recorrente (Criar próxima semana automaticamente)</span>
                                </label>
                            </div>

                            {profile?.role === 'Admin' && (
                                <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Escola</label>
                                        <select
                                            className="form-input"
                                            value={selectedSchoolId}
                                            onChange={e => setSelectedSchoolId(e.target.value)}
                                            required
                                        >
                                            <option value="">Selecionar...</option>
                                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Professor</label>
                                        <select
                                            className="form-input"
                                            value={selectedProfessorId}
                                            onChange={e => setSelectedProfessorId(e.target.value)}
                                            required
                                        >
                                            <option value="">Selecionar...</option>
                                            {professors
                                                .filter(p => !selectedSchoolId || p.school_id === selectedSchoolId)
                                                .map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                                        </select>
                                    </div>
                                </div>
                            )}

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

                .day-selector { display: flex; gap: 0.5rem; overflow-x: auto; margin-bottom: 2rem; padding-bottom: 0.5rem; scrollbar-width: none; }
                .day-selector::-webkit-scrollbar { display: none; }
                .day-btn { 
                    flex: 1; min-width: 65px; display: flex; flex-direction: column; align-items: center; 
                    padding: 0.75rem 0.5rem; background: var(--bg-card); border: 1px solid var(--border); 
                    border-radius: 0.75rem; cursor: pointer; transition: all 0.2s;
                }
                .day-btn.active { background: var(--primary); border-color: var(--primary); transform: scale(1.05); }
                .day-btn.active .day-short, .day-btn.active .day-date { color: white; }
                .day-short { font-weight: 700; color: white; font-size: 0.8rem; text-transform: uppercase; }
                .day-date { font-size: 0.65rem; color: var(--text-muted); margin-top: 0.2rem; }
                
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

                .btn-view-bookings {
                    background: rgba(16, 185, 129, 0.1);
                    color: var(--primary);
                    border: 1px solid rgba(16, 185, 129, 0.3);
                    border-radius: 0.5rem;
                    cursor: pointer;
                    font-weight: 600;
                    transition: all 0.2s;
                }
                .btn-view-bookings:hover {
                    background: rgba(16, 185, 129, 0.2);
                    border-color: var(--primary);
                }

                .status-badge {
                    padding: 0.2rem 0.5rem;
                    border-radius: 9999px;
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .status-badge.status-presente { background: rgba(16, 185, 129, 0.15); color: var(--primary); }
                .status-badge.status-marcado { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
                .status-badge.status-falta { background: rgba(239, 68, 68, 0.15); color: var(--danger); }
            `}</style>
        </div>
    );
}
