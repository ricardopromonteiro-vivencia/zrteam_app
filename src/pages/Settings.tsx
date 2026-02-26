import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, User, ShieldCheck } from 'lucide-react';

export default function Settings() {
    const { profile } = useOutletContext<{ profile: any }>();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleUpdatePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setMessage({ type: 'error', text: 'As palavras-passe não coincidem.' });
            return;
        }

        setLoading(true);
        setMessage(null);

        const { error } = await supabase.auth.updateUser({
            password: password
        });

        if (error) {
            setMessage({ type: 'error', text: 'Erro ao atualizar: ' + error.message });
        } else {
            setMessage({ type: 'success', text: 'Palavra-passe atualizada com sucesso!' });
            setPassword('');
            setConfirmPassword('');
        }
        setLoading(false);
    };

    return (
        <div className="settings-page animate-fade-in">
            <h1 className="page-title">Área Pessoal</h1>

            <div className="settings-grid">
                <div className="settings-card">
                    <div className="card-header">
                        <User className="text-primary" />
                        <h2>O Teu Perfil</h2>
                    </div>
                    <div className="profile-info">
                        <div className="info-item">
                            <label>Nome Completo</label>
                            <p>{profile.full_name}</p>
                        </div>
                        <div className="info-item">
                            <label>Função</label>
                            <p><span className="role-badge">{profile.role}</span></p>
                        </div>
                        <div className="info-item">
                            <label>Faixa / Graduação</label>
                            <p>{profile.belt} - {profile.degrees} Graus</p>
                        </div>
                    </div>
                </div>

                <div className="settings-card">
                    <div className="card-header">
                        <Lock className="text-primary" />
                        <h2>Segurança</h2>
                    </div>
                    <p className="text-muted" style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                        Altera a tua palavra-passe de acesso à plataforma.
                    </p>

                    {message && (
                        <div className={`message-box message-${message.type}`}>
                            <ShieldCheck size={18} /> {message.text}
                        </div>
                    )}

                    <form onSubmit={handleUpdatePassword}>
                        <div className="form-group">
                            <label className="form-label">Nova Palavra-passe</label>
                            <input
                                type="password"
                                className="form-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                minLength={6}
                                placeholder="Mínimo 6 caracteres"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">Confirmar Palavra-passe</label>
                            <input
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repete a nova palavra-passe"
                            />
                        </div>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? 'A guardar...' : 'Atualizar Palavra-passe'}
                        </button>
                    </form>
                </div>
            </div>

            <style>{`
                .settings-page { max-width: 1000px; margin: 0 auto; }
                .settings-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 2rem; }
                .settings-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 2rem; }
                .card-header { display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; }
                .card-header h2 { font-size: 1.25rem; color: white; margin: 0; }
                
                .profile-info { display: flex; flex-direction: column; gap: 1.25rem; }
                .info-item label { display: block; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.25rem; }
                .info-item p { color: white; font-weight: 500; }
                
                .message-box { padding: 0.75rem 1rem; border-radius: 0.5rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; }
                .message-success { background: rgba(16, 185, 129, 0.1); color: var(--primary); border: 1px solid rgba(16, 185, 129, 0.2); }
                .message-error { background: rgba(239, 68, 68, 0.1); color: var(--danger); border: 1px solid rgba(239, 68, 68, 0.2); }
                
                .text-muted { color: var(--text-muted); }
                .role-badge { background: rgba(16, 185, 129, 0.1); color: var(--primary); padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.7rem; font-weight: 700; }
            `}</style>
        </div>
    );
}
