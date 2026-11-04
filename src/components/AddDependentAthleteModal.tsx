import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { X, UserPlus, AlertTriangle, CheckCircle } from 'lucide-react';

const BELTS = [
    'Branco Kid',
    'Cinza/ branco', 'Cinza', 'Cinza/ Preto',
    'Amarelo / Branco', 'Amarelo', 'Amarelo/ preto',
    'Laranja/ Branco', 'Laranja', 'Laranja/ preto',
    'Verde / Branco', 'Verde', 'Verde / Preto',
    'Branco', 'Azul', 'Roxo', 'Marrom', 'Preto'
];

interface Props {
    onClose: () => void;
    onSuccess: () => void;
}

export default function AddDependentAthleteModal({ onClose, onSuccess }: Props) {
    const [form, setForm] = useState({
        full_name: '',
        date_of_birth: '',
        school_id: '',
        belt: 'Branco',
        degrees: 0,
        assigned_professor_id: '',
    });
    const [schools, setSchools] = useState<any[]>([]);
    const [professors, setProfessors] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        async function loadOptions() {
            const { data: schoolsData } = await supabase
                .from('schools')
                .select('id, name')
                .order('order_index', { ascending: true })
                .order('name');
            if (schoolsData) setSchools(schoolsData);

            const { data: profsData } = await supabase
                .from('profiles')
                .select('id, full_name, school_id')
                .in('role', ['Professor', 'Professor Responsável', 'Admin'])
                .order('full_name');
            if (profsData) setProfessors(profsData);
        }
        loadOptions();
    }, []);

    const filteredProfessors = form.school_id
        ? professors.filter(p => p.school_id === form.school_id)
        : professors;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validações do lado cliente
        if (!form.full_name.trim()) {
            setMessage({ type: 'error', text: 'O nome completo é obrigatório.' });
            return;
        }
        if (!form.date_of_birth) {
            setMessage({ type: 'error', text: 'A data de nascimento é obrigatória.' });
            return;
        }
        if (!form.school_id) {
            setMessage({ type: 'error', text: 'Seleciona a escola do atleta.' });
            return;
        }
        if (!form.assigned_professor_id) {
            setMessage({ type: 'error', text: 'Seleciona o professor do atleta.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        const { data, error } = await supabase.rpc('create_dependent_athlete', {
            p_full_name: form.full_name.trim(),
            p_date_of_birth: form.date_of_birth,
            p_school_id: form.school_id,
            p_belt: form.belt,
            p_degrees: form.degrees,
            p_assigned_professor_id: form.assigned_professor_id,
        });

        setLoading(false);

        if (error) {
            setMessage({ type: 'error', text: 'Erro ao criar atleta: ' + error.message });
            return;
        }

        // O RPC retorna { success: bool, error?: string, message?: string }
        if (data && data.success === false) {
            setMessage({ type: 'error', text: data.error || 'Erro ao criar atleta.' });
            return;
        }

        setMessage({ type: 'success', text: 'Atleta criado com sucesso! Aguarda aprovação do professor ou administrador.' });
        setTimeout(() => {
            onSuccess();
            onClose();
        }, 2000);
    };

    const set = (field: string, value: any) =>
        setForm(prev => ({
            ...prev,
            [field]: value,
            ...(field === 'school_id' ? { assigned_professor_id: '' } : {}),
        }));

    return (
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '1rem',
                backdropFilter: 'blur(4px)',
            }}
            onClick={e => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                style={{
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border)',
                    borderRadius: '1.25rem',
                    padding: '2rem',
                    width: '100%',
                    maxWidth: '480px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1.25rem',
                }}
            >
                {/* Cabeçalho */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                            background: 'rgba(16,185,129,0.1)',
                            borderRadius: '0.75rem',
                            padding: '0.6rem',
                            display: 'flex',
                            color: 'var(--primary)',
                        }}>
                            <UserPlus size={20} />
                        </div>
                        <div>
                            <h2 style={{ color: 'white', fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>
                                Criar Novo Atleta
                            </h2>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', margin: 0 }}>
                                Atleta associado a esta conta
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            padding: '0.4rem',
                            borderRadius: '0.5rem',
                            display: 'flex',
                        }}
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Mensagem de feedback */}
                {message && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.6rem',
                        padding: '0.75rem 1rem',
                        borderRadius: '0.75rem',
                        fontSize: '0.875rem',
                        background: message.type === 'success' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                        color: message.type === 'success' ? 'var(--primary)' : '#ef4444',
                    }}>
                        {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                        {message.text}
                    </div>
                )}

                {/* Formulário */}
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* Nome Completo */}
                    <div className="form-group">
                        <label className="form-label">Nome Completo *</label>
                        <input
                            className="form-input"
                            type="text"
                            placeholder="Ex: João Manuel dos Santos Silva"
                            value={form.full_name}
                            onChange={e => set('full_name', e.target.value)}
                            required
                            maxLength={150}
                        />
                    </div>

                    {/* Escola e Data de Nascimento */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">Escola *</label>
                            <select
                                className="form-input"
                                value={form.school_id}
                                onChange={e => set('school_id', e.target.value)}
                                required
                            >
                                <option value="">Seleciona...</option>
                                {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Data de Nascimento *</label>
                            <input
                                className="form-input"
                                type="date"
                                value={form.date_of_birth}
                                onChange={e => set('date_of_birth', e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* Faixa Cor */}
                    <div className="form-group">
                        <label className="form-label">Faixa Cor *</label>
                        <select
                            className="form-input"
                            value={form.belt}
                            onChange={e => set('belt', e.target.value)}
                            required
                        >
                            {BELTS.map(b => <option key={b} value={b}>{b}</option>)}
                        </select>
                    </div>

                    {/* Grau e Professor */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                        <div className="form-group">
                            <label className="form-label">Grau (0–4) *</label>
                            <select
                                className="form-input"
                                value={form.degrees}
                                onChange={e => set('degrees', parseInt(e.target.value))}
                                required
                            >
                                {[0, 1, 2, 3, 4].map(d => (
                                    <option key={d} value={d}>{d}° Grau</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="form-label">Professor *</label>
                            <select
                                className="form-input"
                                value={form.assigned_professor_id}
                                onChange={e => set('assigned_professor_id', e.target.value)}
                                required
                            >
                                <option value="">Seleciona...</option>
                                {filteredProfessors.map(p => (
                                    <option key={p.id} value={p.id}>{p.full_name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Aviso */}
                    <div style={{
                        background: 'rgba(245,158,11,0.08)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        borderRadius: '0.75rem',
                        padding: '0.75rem 1rem',
                        fontSize: '0.8rem',
                        color: '#f59e0b',
                        display: 'flex',
                        gap: '0.5rem',
                        alignItems: 'flex-start',
                    }}>
                        <span style={{ flexShrink: 0 }}>⏳</span>
                        <span>
                            Após criar o atleta, este ficará <strong>pendente de aprovação</strong> pelo professor ou administrador.
                            Só após aprovação poderás fazer check-in e marcações em nome deste atleta.
                        </span>
                    </div>

                    {/* Botões */}
                    <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
                        <button
                            type="button"
                            onClick={onClose}
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-muted)',
                                borderRadius: '0.75rem',
                                padding: '0.65rem 1.25rem',
                                cursor: 'pointer',
                                fontSize: '0.9rem',
                            }}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                background: loading ? 'rgba(16,185,129,0.4)' : 'var(--primary)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '0.75rem',
                                padding: '0.65rem 1.5rem',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                fontSize: '0.9rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s',
                            }}
                        >
                            {loading ? (
                                <>
                                    <span style={{
                                        width: 16, height: 16,
                                        border: '2px solid rgba(255,255,255,0.3)',
                                        borderTop: '2px solid white',
                                        borderRadius: '50%',
                                        animation: 'spin 0.7s linear infinite',
                                        display: 'inline-block',
                                    }} />
                                    A criar...
                                </>
                            ) : (
                                <>
                                    <UserPlus size={16} />
                                    Criar Atleta
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}

