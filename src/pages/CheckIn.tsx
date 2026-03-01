import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle, XCircle, Clock, AlertTriangle, Users, Plus } from 'lucide-react';

export default function CheckIn() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [todayClasses, setTodayClasses] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState<any>(null);
    const [bookings, setBookings] = useState<any[]>([]);
    const [allSchoolAthletes, setAllSchoolAthletes] = useState<any[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const isAdmin = profile?.role === 'Admin' || profile?.role === 'Professor';

    // Buscar aulas e atletas da própria escola
    useEffect(() => {
        const today = new Date().toISOString().split('T')[0];

        // Aulas de hoje: Filtrar por escola do professor ou mostrar órfãs (null)
        let classesQuery = supabase
            .from('classes')
            .select('*')
            .eq('date', today);

        if (profile?.school_id) {
            classesQuery = classesQuery.or(`school_id.eq.${profile.school_id},school_id.is.null`);
        } else {
            classesQuery = classesQuery.is('school_id', null);
        }

        classesQuery.then(({ data }) => {
            if (data) setTodayClasses(data);
        });

        // Todos os atletas da escola (se o professor tiver escola)
        if (profile?.school_id) {
            supabase
                .from('profiles')
                .select('id, full_name, belt, degrees')
                .eq('school_id', profile.school_id)
                .eq('role', 'Atleta')
                .order('full_name')
                .then(({ data }) => {
                    if (data) setAllSchoolAthletes(data);
                });
        }
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

    // Check-in para atleta que NÃO estava inscrito (Inscreve e marca presença)
    const handleQuickCheckIn = async (athlete: any) => {
        if (!selectedClass) return;

        setLoading(true);
        // 1. Criar a reserva já como Presente
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
            if (error.code === '23505') { // Unicidade: já estava inscrito?
                alert('Este atleta já está na lista de inscritos.');
            } else {
                alert('Erro ao registar: ' + error.message);
            }
        } else {
            // 2. Incrementar contador
            await supabase.rpc('increment_attended_classes', { user_id_param: athlete.id });
            await loadBookings(selectedClass);
            setSearchQuery('');
        }
        setLoading(false);
    };

    const filteredAthletes = searchQuery.trim().length > 1
        ? allSchoolAthletes.filter(a =>
            a.full_name.toLowerCase().includes(searchQuery.toLowerCase()) &&
            !bookings.some(b => b.user_id?.id === a.id)
        )
        : [];

    const isClassFinished = (cls: any) => {
        if (!cls) return false;
        const now = new Date();
        const classEnd = new Date(`${cls.date}T${cls.end_time}`);
        return now > classEnd;
    };

    if (!isAdmin) {
        return <div style={{ color: 'var(--danger)', padding: '2rem' }}>Acesso restrito a Professores e Administradores.</div>;
    }

    return (
        <div className="checkin-page animate-fade-in">
            <h1 className="page-title">Painel de Check-in</h1>

            {/* Aulas de Hoje */}
            <div className="today-classes">
                <h2 className="section-title">Aulas de Hoje</h2>
                {todayClasses.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)' }}>Não há aulas agendadas para hoje.</p>
                ) : (
                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {todayClasses.map(cls => (
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
                                            onClick={() => handleQuickCheckIn(athlete)}
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
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
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
      `}</style>
        </div>
    );
}
