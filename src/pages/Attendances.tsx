import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { Search, Calendar, MapPin, Activity, Loader2, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { format } from 'date-fns';

type AttendanceRecord = {
    booking_id: string;
    user_id: string;
    full_name: string;
    belt: string;
    class_id: string;
    class_title: string;
    class_date: string;
    class_start_time: string;
    school_id: string;
    school_name: string;
    status: 'Marcado' | 'Presente' | 'Falta';
    created_at: string;
};

export default function Attendances() {
    const [profile, setProfile] = useState<any>(null);
    const [records, setRecords] = useState<AttendanceRecord[]>([]);
    const [schools, setSchools] = useState<{ id: string, name: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [savingId, setSavingId] = useState<string | null>(null);

    // Filtros
    const [searchQuery, setSearchQuery] = useState('');
    const [schoolFilter, setSchoolFilter] = useState('all');
    const [dateFilter, setDateFilter] = useState('all');

    useEffect(() => {
        loadData();
    }, []);

    async function loadData() {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: prof } = await supabase
            .from('profiles')
            .select('role, school_id')
            .eq('id', session.user.id)
            .single();

        setProfile(prof);

        if (prof?.role === 'Admin') {
            const { data: sData } = await supabase.from('schools').select('id, name').order('name');
            if (sData) setSchools(sData);
        }

        // Buscar dados utilizando a nova RPC (Últimos 7 dias)
        const { data: rData, error } = await supabase.rpc('get_recent_attendances', {
            p_days_ago: 7,
            p_requesting_user_id: session.user.id,
            p_requesting_role: prof?.role,
            p_requesting_school_id: prof?.school_id
        });

        if (rData && !error) {
            setRecords(rData);
        } else {
            console.error("Erro a carregar marcações:", error);
        }

        setLoading(false);
    }

    const uniqueDates = useMemo(() => {
        const dates = new Set(records.map(r => r.class_date));
        return Array.from(dates).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    }, [records]);

    const filteredRecords = useMemo(() => {
        return records.filter(record => {
            const matchesSearch = 
                record.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                record.class_title.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesSchool = schoolFilter === 'all' || record.school_id === schoolFilter;
            const matchesDate = dateFilter === 'all' || record.class_date === dateFilter;

            return matchesSearch && matchesSchool && matchesDate;
        });
    }, [records, searchQuery, schoolFilter, dateFilter]);

    async function handleStatusChange(bookingId: string, newStatus: string) {
        setSavingId(bookingId);
        const { error } = await supabase
            .from('class_bookings')
            .update({ status: newStatus })
            .eq('id', bookingId);

        if (!error) {
            setRecords(prev => prev.map(r => 
                r.booking_id === bookingId ? { ...r, status: newStatus as any } : r
            ));
        } else {
            alert('Erro ao guardar alteração.');
        }
        setSavingId(null);
    }

    if (!profile || (profile.role !== 'Admin' && profile.role !== 'Professor Responsável')) {
        return (
            <div className="p-8 text-center text-gray-400">
                Acesso não autorizado. Apenas Administradores ou Professores Responsáveis.
            </div>
        );
    }

    return (
        <div className="attendances-page animate-fade-in p-2 sm:p-6 pb-20">
            <PageHeader
                title="Consultar Marcações"
                icon={Activity}
            />

            <div className="filters-container">
                <div className="search-bar">
                    <Search className="search-icon" size={20} />
                    <input
                        type="text"
                        placeholder="Pesquisar por atleta ou aula..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="search-input"
                    />
                </div>

                <div className="select-filters">
                    {profile.role === 'Admin' && (
                        <select 
                            value={schoolFilter} 
                            onChange={(e) => setSchoolFilter(e.target.value)}
                            className="filter-select"
                        >
                            <option value="all">Todas as Escolas</option>
                            {schools.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    )}

                    <select 
                        value={dateFilter} 
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="filter-select"
                    >
                        <option value="all">Últimos 7 dias (Todas)</option>
                        {uniqueDates.map((date: any) => (
                            <option key={date} value={date}>
                                {format(new Date(date), 'dd/MM/yyyy')}
                            </option>
                        ))}
                    </select>

                    <button onClick={loadData} className="refresh-btn" title="Atualizar dados" disabled={loading}>
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading && records.length === 0 ? (
                <div className="loading-state">A carregar registos...</div>
            ) : filteredRecords.length === 0 ? (
                <div className="empty-state">
                    Nenhuma marcação encontrada com os filtros atuais nos últimos 7 dias.
                </div>
            ) : (
                <div className="table-responsive">
                    <table className="attendances-table">
                        <thead>
                            <tr>
                                <th>Atleta</th>
                                <th>Aula</th>
                                <th>Data / Hora</th>
                                {profile.role === 'Admin' && <th>Escola</th>}
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecords.map(record => (
                                <tr key={record.booking_id} className={savingId === record.booking_id ? 'saving-row' : ''}>
                                    <td data-label="Atleta">
                                        <div>
                                            <div className="font-semibold">{record.full_name}</div>
                                            <div className="text-xs text-gray-400">{record.belt}</div>
                                        </div>
                                    </td>
                                    <td data-label="Aula">
                                        <div>{record.class_title}</div>
                                    </td>
                                    <td data-label="Data / Hora">
                                        <div className="date-time">
                                            <Calendar size={14} /> {format(new Date(record.class_date), 'dd/MM/yyyy')}
                                            <span style={{ margin: '0 4px', opacity: 0.5 }}>•</span>
                                            {record.class_start_time.substring(0, 5)}
                                        </div>
                                    </td>
                                    {profile.role === 'Admin' && (
                                        <td data-label="Escola">
                                            <div className="school-info">
                                                <MapPin size={14} /> {record.school_name || 'Sem Escola'}
                                            </div>
                                        </td>
                                    )}
                                    <td data-label="Estado">
                                        <div className="status-control">
                                            <select
                                                value={record.status}
                                                onChange={(e) => handleStatusChange(record.booking_id, e.target.value)}
                                                className={`status-select status-${record.status.toLowerCase()}`}
                                                disabled={savingId === record.booking_id}
                                            >
                                                <option value="Marcado">Marcado</option>
                                                <option value="Presente">Presente</option>
                                                <option value="Falta">Falta</option>
                                            </select>
                                            {savingId === record.booking_id && <Loader2 size={16} className="animate-spin text-primary ml-2" />}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <style>{`
                .attendances-page {
                    max-width: 1200px;
                    margin: 0 auto;
                }
                .filters-container {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                    margin-bottom: 2rem;
                    background: var(--bg-card);
                    padding: 1.5rem;
                    border-radius: 1rem;
                    border: 1px solid var(--border);
                }
                @media (min-width: 768px) {
                    .filters-container {
                        flex-direction: row;
                        align-items: center;
                        justify-content: space-between;
                    }
                }
                .search-bar {
                    position: relative;
                    flex: 1;
                    max-width: 400px;
                }
                .search-icon {
                    position: absolute;
                    left: 1rem;
                    top: 50%;
                    transform: translateY(-50%);
                    color: var(--text-muted);
                }
                .search-input {
                    width: 100%;
                    background: var(--bg-dark);
                    border: 1px solid var(--border);
                    color: white;
                    padding: 0.75rem 1rem 0.75rem 2.8rem;
                    border-radius: 0.5rem;
                }
                .search-input:focus {
                    border-color: var(--primary);
                    outline: none;
                }
                .select-filters {
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }
                .filter-select {
                    background: var(--bg-dark);
                    border: 1px solid var(--border);
                    color: white;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    min-width: 150px;
                }
                .refresh-btn {
                    background: var(--bg-dark);
                    border: 1px solid var(--border);
                    color: white;
                    padding: 0.75rem;
                    border-radius: 0.5rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                .refresh-btn:hover:not(:disabled) {
                    border-color: var(--primary);
                    color: var(--primary);
                }

                /* Mobile Responsiveness for Table */
                @media (max-width: 768px) {
                    .filters-container {
                        padding: 1rem;
                    }
                    .search-input {
                        width: 100%;
                    }
                    .select-filters {
                        flex-direction: column;
                        width: 100%;
                    }
                    .filter-select {
                        width: 100%;
                    }
                    .table-responsive {
                        background: transparent;
                        border: none;
                        padding: 0;
                    }
                    .attendances-table, .attendances-table tbody, .attendances-table tr, .attendances-table td {
                        display: block;
                        width: 100%;
                    }
                    .attendances-table thead {
                        display: none;
                    }
                    .attendances-table tr {
                        background: var(--bg-card);
                        border: 1px solid var(--border);
                        border-radius: 1rem;
                        margin-bottom: 1rem;
                        padding: 1.25rem;
                        position: relative;
                        display: flex;
                        flex-direction: column;
                        gap: 0.75rem;
                    }
                    .attendances-table td {
                        border: none;
                        padding: 0;
                        display: flex;
                        flex-direction: column;
                        align-items: flex-start;
                        text-align: left;
                        gap: 0.25rem;
                    }
                    .attendances-table td::before {
                        content: attr(data-label);
                        font-weight: 600;
                        color: rgba(255,255,255,0.4);
                        font-size: 0.7rem;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        margin-bottom: 0.25rem;
                    }
                    .attendances-table td > div {
                        text-align: left;
                        width: 100%;
                    }
                    .date-time, .school-info {
                        color: white;
                    }
                    .status-control {
                        margin-top: 0.5rem;
                        width: 100%;
                    }
                    .status-select {
                        width: 100%;
                        text-align: center;
                        padding: 0.875rem;
                    }
                }
                
                .table-responsive {
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 1rem;
                    overflow-x: auto;
                }
                .attendances-table {
                    width: 100%;
                    border-collapse: collapse;
                    text-align: left;
                }
                .attendances-table th,
                .attendances-table td {
                    padding: 1rem 1.5rem;
                    border-bottom: 1px solid var(--border);
                    white-space: nowrap;
                }
                .attendances-table th {
                    color: var(--text-muted);
                    font-size: 0.875rem;
                    font-weight: 500;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .attendances-table tr:last-child td {
                    border-bottom: none;
                }
                .attendances-table tr:hover {
                    background: rgba(255, 255, 255, 0.02);
                }
                .saving-row {
                    opacity: 0.6;
                }
                .date-time, .school-info {
                    display: flex;
                    align-items: center;
                    gap: 0.35rem;
                    color: var(--text-muted);
                    font-size: 0.875rem;
                }
                
                .status-control {
                    display: flex;
                    align-items: center;
                }
                .status-select {
                    padding: 0.5rem 1rem;
                    border-radius: 9999px;
                    font-weight: 600;
                    font-size: 0.75rem;
                    text-transform: uppercase;
                    border: 1px solid transparent;
                    cursor: pointer;
                    appearance: none;
                    background-color: var(--bg-dark);
                    color: white;
                }
                .status-select:focus {
                    outline: none;
                    border-color: rgba(255,255,255,0.2);
                }
                
                /* Custom styles based on selected value using classNames */
                .status-marcado {
                    background-color: rgba(99, 102, 241, 0.1);
                    color: #818cf8;
                    border-color: rgba(99, 102, 241, 0.2);
                }
                .status-presente {
                    background-color: rgba(16, 185, 129, 0.1);
                    color: #34d399;
                    border-color: rgba(16, 185, 129, 0.2);
                }
                .status-falta {
                    background-color: rgba(239, 68, 68, 0.1);
                    color: #f87171;
                    border-color: rgba(239, 68, 68, 0.2);
                }

                .loading-state, .empty-state {
                    text-align: center;
                    padding: 4rem 2rem;
                    color: var(--text-muted);
                    background: var(--bg-card);
                    border: 1px solid var(--border);
                    border-radius: 1rem;
                }
            `}</style>
        </div>
    );
}
