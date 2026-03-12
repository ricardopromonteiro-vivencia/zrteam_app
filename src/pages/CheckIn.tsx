import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isProfessor as checkIsProfessor } from '../lib/roles';
import { CheckCircle, XCircle, Clock, AlertTriangle, Users, Plus } from 'lucide-react';

export default function CheckIn() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [bookings, setBookings] = useState<any[]>([]);
    const [allSchoolAthletes, setAllSchoolAthletes] = useState<any[]>([]);
    const [schools, setSchools] = useState<any[]>([]);
    const [filterSchool, setFilterSchool] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [pendingAthleteConfirm, setPendingAthleteConfirm] = useState<any>(null);

    const isAdmin = profile?.role === 'Admin';
    const isProfessor = checkIsProfessor(profile?.role);
    const isHeadProfessor = profile?.school?.head_professor_id === profile?.id;

    // Buscar aulas e atletas da própria escola
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];

        // Buscar escolas para admin
        if (isAdmin) {
            supabase.from('schools').select('id, name').order('order_index').order('name').then(({ data }) => {
                if (data) setSchools(data);
            });
        }

        // Aulas de hoje: Filtrar por escola do professor ou mostrar órfãs (null)
        // Admins vêem todas
        let classesQuery = supabase
            .from('classes')
            .select('*')
            .eq('date', today);

        if (checkIsProfessor(profile?.role) && profile?.school_id) {
            classesQuery = classesQuery.or(`school_id.eq.${profile.school_id},school_id.is.null,professor_id.eq.${profile.id},second_professor_id.eq.${profile.id}`);
        } else if (checkIsProfessor(profile?.role)) {
            classesQuery = classesQuery.or(`school_id.is.null,professor_id.eq.${profile.id},second_professor_id.eq.${profile.id}`);
        }
        // Se for Admin, não aplicamos filtro de escola (vê todas as aulas de hoje)

        classesQuery.then(({ data }) => {
            if (data) {
                const sorted = [...data].sort((a: any, b: any) =>
                    a.start_time.localeCompare(b.start_time)
                );
                setTodayClasses(sorted);
            }
        });

        // Atletas: Admin vê todos, Professor vê os da sua escola
        let athleteQuery = supabase
            .from('profiles')
            .select('id, full_name, belt, degrees, school_id')
            .eq('role', 'Atleta')
            .eq('is_archived', false)
            .order('full_name');

        if (isAdmin) {
            // Admin vê todos, sem filtro de escola
        } else if (profile?.school_id) {
            athleteQuery = athleteQuery.eq('school_id', profile.school_id);
            if (isProfessor && !isHeadProfessor) {
                athleteQuery = athleteQuery.eq('assigned_professor_id', profile.id);
            }
        }

        athleteQuery.then(({ data }) => {
            if (data) setAllSchoolAthletes(data);
        });
    }, [profile]);

    // Buscar inscritos quando uma aula é selecionada
    const loadBookings = async (cls: any) => {
        setSelectedClass(cls);
        setLoading(true);
        const { data } = await supabase
            .from('class_bookings')
            .select('*, user_id(id, full_name, belt, degrees)')
            .eq('class_id', cls.id)
            .order('created_at');
        if (data) setBookings(data);
        setLoading(false);
    };

    // Check-in manual pelo professor
    const handleManualCheckIn = async (bookingId: string, userId: string) => {
        // 1. Marcar como Presente
        const { error } = await supabase
            .from('class_bookings')
            .update({ status: 'Presente' })
            .eq('id', bookingId);

        if (!error) {
            // 2. Incrementar contador de aulas do atleta
            await supabase.rpc('increment_attended_classes', { user_id_param: userId });
            // Refrescar lista
            loadBookings(selectedClass);
        } else {
            alert('Erro ao registar presença: ' + error.message);
        }
    };

    // Penalização: marcar "Falta" e deduzir 1 aula a quem não apareceu
    const handlePenalize = async () => {
        if (!selectedClass) return;
        if (!confirm('Vais penalizar todos os "Marcado" desta aula (descontar 1 presença). Confirmas?')) return;

        const noShows = bookings.filter(b => b.status === 'Marcado');

        for (const booking of noShows) {
            // Marcar como Falta
            await supabase.from('class_bookings').update({ status: 'Falta' }).eq('id', booking.id);
            // Deduzir 1 presença (não vai abaixo de 0)
            await supabase.rpc('decrement_attended_classes', { user_id_param: booking.user_id.id });
        }

        alert(`${noShows.length} atleta(s) penalizado(s).`);
        loadBookings(selectedClass);
    };

    // Solicita confirmação antes de fazer check-in rápido
    const handleQuickCheckInRequest = (athlete: any) => {
        setPendingAthleteConfirm(athlete);
        setSearchQuery('');
    };

    // Confirma e executa o check-in após popup
    const handleQuickCheckIn = async (athlete: any) => {
        if (!selectedClass) return;
        setPendingAthleteConfirm(null);
        setLoading(true);
        const { error } = await supabase
            .from('class_bookings')
            .insert({
                class_id: selectedClass.id,
                user_id: athlete.id,
                status: 'Presente'
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                alert('Este atleta já está na lista de inscritos.');
            } else {
                alert('Erro ao registar: ' + error.message);
            }
        } else {
            await supabase.rpc('increment_attended_classes', { user_id_param: athlete.id });
            await loadBookings(selectedClass);
        }
        setLoading(false);
    };


    // Reverter Check-in: de Presente → Marcado, subtrai a presença
    const handleRevertCheckIn = async (booking: any) => {
        if (!confirm(`Reverter check-in de ${booking.user_id?.full_name}?`)) return;
        setLoading(true);
        // Decrementar contagem
        await supabase.rpc('decrement_attended_classes', { user_id_param: booking.user_id?.id });
        // Mudar status para Marcado
        const { error } = await supabase
            .from('class_bookings')
            .update({ status: 'Marcado' })
            .eq('id', booking.id);
        if (!error) {
            loadBookings(selectedClass);
        } else {
            alert('Erro ao reverter: ' + error.message);
        }
        setLoading(false);
    };


    // Remover inscrição (mesmo que Presente)
    const handleRemoveBooking = async (booking: any) => {
        if (!confirm(`Remover ${booking.user_id?.full_name} desta aula?`)) return;
        setLoading(true);
        if (booking.status === 'Presente') {
            await supabase.rpc('decrement_attended_classes', { user_id_param: booking.user_id?.id });
        }
        const { error } = await supabase
            .from('class_bookings')
            .delete()
            .eq('id', booking.id);
        if (!error) {
            loadBookings(selectedClass);
        } else {
            alert('Erro ao remover: ' + error.message);
        }
        setLoading(false);
    };

    const displayedClasses = todayClasses.filter(cls => filterSchool === 'all' || cls.school_id === filterSchool);
    const displayedAthletes = allSchoolAthletes.filter(a => filterSchool === 'all' || a.school_id === filterSchool);

    const filteredAthletes = searchQuery.trim().length >= 1
        ? displayedAthletes.filter((a: any) =>
            a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !bookings.some((b: any) => b.user_id?.id === a.id)
        )
        : [];

    const isClassFinished = (cls: any) => {
        if (!cls) return false;
        const now = new Date();
        const classEnd = new Date(`${cls.date}T${cls.end_time}`);
        return now > classEnd;
    };

    if (!isAdmin && !isProfessor) {
        return <div style={{ color: 'var(--danger)', padding: '2rem' }}>Acesso restrito a Professores e Administradores.</div>;
    }

    return (
        <div className="checkin-page animate-fade-in">
            <h1 className="page-title">Painel de Check-in</h1>

            {isAdmin && schools.length > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <select
                        value={filterSchool}
                        onChange={e => {
                            setFilterSchool(e.target.value);
                            setSelectedClass(null);
                        }}
                        style={{
                            background: 'var(--bg-card)', border: '1px solid var(--border)',
                            borderRadius: '0.5rem', padding: '0.4rem 0.75rem',
                            color: filterSchool !== 'all' ? 'var(--primary)' : 'var(--text-muted)',
                            fontSize: '0.8rem', cursor: 'pointer', outline: 'none'
                        }}
                    >
                        <option value="all">🏫 Todas as Escolas</option>
                        {schools.map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    {filterSchool !== 'all' && (
                        <button
                            onClick={() => { setFilterSchool('all'); setSelectedClass(null); }}
                            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.75rem' }}
                        >
                            ✕ Limpar filtro
                        </button>
                    )}
                </div>
            )}

            {/* Aulas de Hoje */}
            <div className="today-classes">
                <h2 className="section-title">Aulas de Hoje</h2>
                {displayedClasses.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>Não há aulas agendadas para hoje.</p>
                ) : (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {displayedClasses.map(cls => (
                            <button
                                key={cls.id}
                                onClick={() => loadBookings(cls)}
                                className={`class-select-btn ${selectedClass?.id === cls.id ? 'active' : ''}`}
                            >
                                <strong>{cls.title}</strong>
                                <span>{cls.start_time.substring(0, 5)} - {cls.end_time.substring(0, 5)}</span>
                                {isClassFinished(cls) && (
                                    <span className="badge-ended">TERMINADA</span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {selectedClass && (
                <>
                    {/* Pesquisa de Atletas para Check-in Direto */}
                    <div className="search-panel">
                        <Users size={20} className="text-primary" />
                        <div style={{ flex: 1, position: 'relative' }}>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="Procurar atleta pelo nome para check-in rápido..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />

                            {filteredAthletes.length > 0 && (
                                <div className="search-results">
                                    {filteredAthletes.map(athlete => (
                                        <div
                                            key={athlete.id}
                                            className="search-result-item"
                                            onClick={() => handleQuickCheckInRequest(athlete)}
                                        >
                                            <div className="athlete-info">
                                                <span className="athlete-name">{athlete.full_name}</span>
                                                <span className="athlete-belt">{athlete.belt}</span>
                                            </div>
                                            <Plus size={18} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Lista de Inscritos */}
                    <div className="bookings-panel">
                        <div className="bookings-header">
                            <h2 className="section-title" style={{ marginBottom: 0 }}>
                                Inscritos em <span style={{ color: 'var(--primary)' }}>{selectedClass.title}</span>
                                <span style={{ color: 'var(--text-muted)', fontSize: '0.875rem', fontWeight: 400 }}> ({bookings.length} atletas)</span>
                            </h2>
                            {isClassFinished(selectedClass) && (
                                <button onClick={handlePenalize} className="btn-danger">
                                    <AlertTriangle size={18} /> Penalizar "No-Shows"
                                </button>
                            )}
                        </div>

                        {loading ? (
                            <div className="loading-container">
                                <Clock size={24} className="animate-spin" />
                                <p>A atualizar lista de inscritos...</p>
                            </div>
                        ) : bookings.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '2rem' }}>Nenhum atleta inscrito nesta aula ainda.</p>
                        ) : (
                            <div className="bookings-list">
                                {bookings.map(booking => (
                                    <div key={booking.id} className={`booking-row status-${booking.status.toLowerCase()}`}>
                                        <div className="booking-info">
                                            <span className="booking-name">{booking.user_id?.full_name}</span>
                                            <span className="booking-belt">{booking.user_id?.belt} | {booking.user_id?.degrees} Grau(s)</span>
                                        </div>
                                        <div className="booking-actions">
                                            <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                                                {booking.status === 'Presente' && <CheckCircle size={14} />}
                                                {booking.status === 'Marcado' && <Clock size={14} />}
                                                {booking.status === 'Falta' && <XCircle size={14} />}
                                                {booking.status}
                                            </span>
                                            {booking.status === 'Marcado' && (
                                                <button
                                                    className="btn-checkin"
                                                    onClick={() => handleManualCheckIn(booking.id, booking.user_id?.id)}
                                                >
                                                    <CheckCircle size={18} /> Check-in
                                                </button>
                                            )}
                                            {booking.status === 'Presente' && (
                                                <button
                                                    className="btn-revert-checkin"
                                                    onClick={() => handleRevertCheckIn(booking)}
                                                    title="Reverter check-in"
                                                >
                                                    <XCircle size={16} /> Reverter
                                                </button>
                                            )}
                                            <button
                                                className="btn-remove-booking"
                                                onClick={() => handleRemoveBooking(booking)}
                                                title="Remover inscrição"
                                            >
                                                <XCircle size={16} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Popup de Confirmação de Check-in Rápido */}
            {pendingAthleteConfirm && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: '1rem' }}>
                    <div className="modal-confirm-card animate-fade-in">
                        <div style={{ fontSize: '2.5rem', textAlign: 'center' }}>✏️</div>
                        <h3 style={{ color: 'white', textAlign: 'center', margin: '0.5rem 0' }}>Confirmar Check-in</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', textAlign: 'center' }}>
                            Adicionar <strong style={{ color: 'white' }}>{pendingAthleteConfirm.full_name}</strong> ({pendingAthleteConfirm.belt}) à aula <strong style={{ color: 'var(--primary)' }}>{selectedClass?.title}</strong>?
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.7rem', textAlign: 'center', marginTop: '-0.25rem' }}>Será marcado como <em>Presente</em> e a presença será contabilizada.</p>
                        <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', justifyContent: 'center' }}>
                            <button className="btn-danger" style={{ flex: 1, justifyContent: 'center', padding: '0.65rem' }} onClick={() => setPendingAthleteConfirm(null)}>Cancelar</button>
                            <button className="btn-checkin" style={{ flex: 1, justifyContent: 'center', padding: '0.65rem' }} onClick={() => handleQuickCheckIn(pendingAthleteConfirm)}>✅ Confirmar</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .checkin-page { max-width: 900px; margin: 0 auto; }
        .section-title { font-size: 1.125rem; font-weight: 600; color: white; margin-bottom: 1rem; }

        .class-select-btn {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 1rem 1.25rem;
          color: var(--text-main);
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
          cursor: pointer;
          transition: all 0.2s;
          text-align: left;
        }
        .class-select-btn span { font-size: 0.8rem; color: var(--text-muted); }
        .class-select-btn:hover, .class-select-btn.active {
          border-color: var(--primary);
          background-color: rgba(16, 185, 129, 0.05);
        }
        .badge-ended {
          background-color: rgba(239,68,68,0.15);
          color: var(--danger);
          padding: 0.2rem 0.5rem;
          border-radius: 9999px;
          font-size: 0.7rem !important;
          font-weight: 700;
        }

        .search-panel {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          padding: 0.75rem 1.25rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          margin: 1.5rem 0;
          position: relative;
        }
        .search-results {
          position: absolute;
          top: calc(100% + 5px);
          left: 0;
          right: 0;
          background: #1a1a1a;
          border: 1px solid var(--border);
          border-radius: 0.75rem;
          z-index: 50;
          max-height: 250px;
          overflow-y: auto;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }
        .search-result-item {
          padding: 0.75rem 1rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: pointer;
          border-bottom: 1px solid var(--border);
          transition: background 0.2s;
        }
        .search-result-item:last-child { border-bottom: none; }
        .search-result-item:hover { background: rgba(16, 185, 129, 0.1); }
        .athlete-info { display: flex; flex-direction: column; gap: 0.1rem; }
        .athlete-name { font-weight: 600; font-size: 0.9rem; }
        .athlete-belt { font-size: 0.75rem; color: var(--text-muted); }

        .bookings-panel {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1rem;
          padding: 1.5rem;
        }
        .bookings-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .btn-danger {
          background-color: rgba(239,68,68,0.15);
          color: var(--danger);
          border: 1px solid rgba(239,68,68,0.3);
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.875rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-danger:hover { background-color: rgba(239,68,68,0.25); }

        .bookings-list { display: flex; flex-direction: column; gap: 0.75rem; }
        .booking-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem;
          border-radius: 0.75rem;
          border: 1px solid var(--border);
          background-color: rgba(255,255,255,0.02);
          transition: background-color 0.2s;
        }
        .booking-row.status-presente { border-color: rgba(16,185,129,0.3); background-color: rgba(16,185,129,0.05); }
        .booking-row.status-falta { border-color: rgba(239,68,68,0.2); background-color: rgba(239,68,68,0.03); }

        .booking-info { display: flex; flex-direction: column; gap: 0.2rem; }
        .booking-name { font-weight: 600; }
        .booking-belt { font-size: 0.8rem; color: var(--text-muted); }
        .booking-actions { display: flex; align-items: center; gap: 0.75rem; }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.3rem 0.7rem;
          border-radius: 9999px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .status-badge.status-presente { background-color: rgba(16,185,129,0.15); color: var(--primary); }
        .status-badge.status-marcado { background-color: rgba(253,186,116,0.15); color: #fb923c; }
        .status-badge.status-falta { background-color: rgba(239,68,68,0.15); color: var(--danger); }

        .btn-checkin {
          background-color: var(--primary);
          color: white;
          padding: 0.4rem 0.9rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.875rem;
          font-weight: 600;
          transition: all 0.2s;
        }
        .btn-checkin:hover { background-color: var(--primary-dark); }

        .btn-revert-checkin {
          background-color: rgba(245,158,11,0.1);
          color: #f59e0b;
          border: 1px solid rgba(245,158,11,0.3);
          padding: 0.4rem 0.9rem;
          border-radius: 0.5rem;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.8rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-revert-checkin:hover { background-color: rgba(245,158,11,0.25); }


        .today-classes { margin-bottom: 2rem; }
        
        .loading-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          padding: 3rem 0;
          color: var(--text-muted);
        }

        .animate-spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .modal-confirm-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1.25rem;
          padding: 1.5rem 2rem;
          max-width: 380px;
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          box-shadow: 0 25px 60px rgba(0,0,0,0.6);
        }
      `}</style>
        </div>
    );
}
