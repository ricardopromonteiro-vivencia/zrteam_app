import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { CreditCard, CheckCircle, Clock, Search } from 'lucide-react';

const MONTHS = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export default function Payments() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [athletes, setAthletes] = useState<any[]>([]);
    const [payments, setPayments] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

    const isAdmin = profile?.role === 'Admin' || profile?.role === 'Professor';

    useEffect(() => {
        if (isAdmin) {
            fetchData();
        }
    }, [profile, selectedMonth, selectedYear]);

    async function fetchData() {
        setLoading(true);

        // 1. Buscar atletas da escola (ou todos se for Admin sem escola)
        let athletesQuery = supabase
            .from('profiles')
            .select('id, full_name, belt, school_id')
            .eq('role', 'Atleta')
            .order('full_name');

        if (profile?.role === 'Professor') {
            athletesQuery = athletesQuery.eq('school_id', profile.school_id);
        }

        const { data: athletesData } = await athletesQuery;
        if (athletesData) setAthletes(athletesData);

        // 2. Buscar pagamentos para o mês/ano selecionado
        const { data: paymentsData } = await supabase
            .from('payments')
            .select('*')
            .eq('month', selectedMonth)
            .eq('year', selectedYear);

        if (paymentsData) setPayments(paymentsData);

        setLoading(false);
    }

    async function togglePayment(athleteId: string, currentStatus: string | undefined) {
        if (!isAdmin) return;

        if (currentStatus === 'Pago') {
            // Se já está pago, talvez queira marcar como pendente ou apagar
            if (!confirm('Marcar este pagamento como pendente?')) return;
            const { error } = await supabase
                .from('payments')
                .delete()
                .eq('athlete_id', athleteId)
                .eq('month', selectedMonth)
                .eq('year', selectedYear);

            if (!error) fetchData();
        } else {
            // Marcar como pago
            const { error } = await supabase
                .from('payments')
                .insert([{
                    athlete_id: athleteId,
                    month: selectedMonth,
                    year: selectedYear,
                    status: 'Pago',
                    school_id: athletes.find(a => a.id === athleteId)?.school_id
                }]);

            if (!error) fetchData();
            else alert('Erro ao registar pagamento: ' + error.message);
        }
    }

    const filteredAthletes = athletes.filter(a =>
        a.full_name.toLowerCase().includes(search.toLowerCase())
    );

    if (!isAdmin) return <div className="p-8 text-danger">Acesso restrito.</div>;

    return (
        <div className="payments-page animate-fade-in">
            <div className="page-header">
                <div>
                    <h1 className="page-title"><CreditCard size={28} style={{ verticalAlign: 'middle', marginRight: '0.75rem' }} /> Gestão de Pagamentos</h1>
                    <p className="text-muted">Controlo de mensalidades dos atletas.</p>
                </div>
                <div className="header-actions">
                    <div className="month-selector">
                        <select
                            className="form-input"
                            value={selectedMonth}
                            onChange={e => setSelectedMonth(parseInt(e.target.value))}
                        >
                            {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                        </select>
                        <select
                            className="form-input"
                            value={selectedYear}
                            onChange={e => setSelectedYear(parseInt(e.target.value))}
                        >
                            {[2024, 2025, 2026].map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="search-panel">
                <Search size={20} className="text-muted" />
                <input
                    type="text"
                    placeholder="Pesquisar atleta..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="search-input-full"
                />
            </div>

            {loading ? (
                <div className="loading-state">A carregar dados de pagamentos...</div>
            ) : (
                <div className="athletes-list">
                    {filteredAthletes.map(athlete => {
                        const payment = payments.find(p => p.athlete_id === athlete.id);
                        const isPaid = payment?.status === 'Pago';

                        return (
                            <div key={athlete.id} className={`athlete-payment-card ${isPaid ? 'paid' : ''}`}>
                                <div className="athlete-main-info">
                                    <span className="athlete-name">{athlete.full_name}</span>
                                    <span className="athlete-belt-small">{athlete.belt}</span>
                                </div>
                                <div className="payment-status-area">
                                    <button
                                        onClick={() => togglePayment(athlete.id, payment?.status)}
                                        className={`btn-payment-toggle ${isPaid ? 'paid' : 'pending'}`}
                                    >
                                        {isPaid ? (
                                            <><CheckCircle size={18} /> Pago</>
                                        ) : (
                                            <><Clock size={18} /> Pendente</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style>{`
                .payments-page { max-width: 800px; margin: 0 auto; }
                .month-selector { display: flex; gap: 0.5rem; }
                .month-selector select { width: auto; min-width: 120px; }
                
                .search-panel { 
                    background: var(--bg-card); border: 1px solid var(--border); 
                    border-radius: 0.75rem; padding: 0.75rem 1rem; 
                    display: flex; align-items: center; gap: 0.75rem;
                    margin: 1.5rem 0;
                }
                .search-input-full { 
                    background: transparent; border: none; outline: none; 
                    color: white; width: 100%; font-size: 0.9rem;
                }

                .athletes-list { display: flex; flex-direction: column; gap: 0.75rem; }
                
                .athlete-payment-card {
                    background: var(--bg-card); border: 1px solid var(--border);
                    border-radius: 1rem; padding: 1rem 1.5rem;
                    display: flex; justify-content: space-between; align-items: center;
                    transition: all 0.2s;
                }
                .athlete-payment-card.paid { border-color: var(--primary); background: rgba(16, 185, 129, 0.05); }
                .athlete-payment-card:hover { transform: translateX(5px); border-color: rgba(16, 185, 129, 0.3); }

                .athlete-main-info { display: flex; flex-direction: column; gap: 0.25rem; }
                .athlete-name { font-weight: 600; color: white; }
                .athlete-belt-small { font-size: 0.75rem; color: var(--text-muted); }

                .btn-payment-toggle {
                    display: flex; align-items: center; gap: 0.5rem;
                    padding: 0.5rem 1rem; border-radius: 0.5rem;
                    font-size: 0.875rem; font-weight: 600; cursor: pointer;
                    transition: all 0.2s; min-width: 120px; justify-content: center;
                }
                .btn-payment-toggle.pending { 
                    background: rgba(245, 158, 11, 0.1); color: #f59e0b; 
                    border: 1px solid rgba(245, 158, 11, 0.2);
                }
                .btn-payment-toggle.pending:hover { background: rgba(245, 158, 11, 0.25); }
                
                .btn-payment-toggle.paid { 
                    background: var(--primary); color: white; border: 1px solid var(--primary);
                }

                .loading-state { text-align: center; color: var(--text-muted); padding: 3rem; }
                
                @media (max-width: 500px) {
                    .athlete-payment-card { flex-direction: column; align-items: stretch; gap: 1rem; }
                    .payment-status-area button { width: 100%; }
                    .page-header { flex-direction: column; align-items: flex-start; gap: 1rem; }
                    .month-selector { width: 100%; }
                    .month-selector select { flex: 1; }
                }
            `}</style>
        </div>
    );
}
