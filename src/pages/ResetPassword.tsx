import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Lock, ShieldCheck, AlertCircle } from 'lucide-react';

export default function ResetPassword() {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const navigate = useNavigate();

    const handleReset = async (e: React.FormEvent) => {
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
            setMessage({ type: 'success', text: 'Palavra-passe definida com sucesso! A redirecionar para o login...' });
            setTimeout(() => navigate('/'), 3000);
        }
        setLoading(false);
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <img src="/logo.png" alt="ZR Team Logo" className="auth-logo" />
                    <h1>Definir Nova Password</h1>
                    <p className="auth-subtitle">Escolhe uma password segura para a tua conta.</p>
                </div>

                {message && (
                    <div className={`message-box message-${message.type}`}>
                        {message.type === 'success' ? <ShieldCheck size={18} /> : <AlertCircle size={18} />}
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleReset} className="auth-form">
                    <div className="form-group">
                        <label className="form-label">Nova Palavra-passe</label>
                        <div className="input-with-icon">
                            <Lock className="input-icon" size={18} />
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
                    </div>

                    <div className="form-group">
                        <label className="form-label">Confirmar Palavra-passe</label>
                        <div className="input-with-icon">
                            <Lock className="input-icon" size={18} />
                            <input
                                type="password"
                                className="form-input"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                                placeholder="Repete a palavra-passe"
                            />
                        </div>
                    </div>

                    <button type="submit" className="btn-primary auth-submit" disabled={loading}>
                        {loading ? 'A guardar...' : 'Confirmar Nova Password'}
                    </button>
                </form>
            </div>

            <style>{`
                .auth-container {
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: radial-gradient(circle at top right, #1a2c23, #121212);
                    padding: 1.5rem;
                }
                .auth-card {
                    background: rgba(23, 23, 23, 0.8);
                    backdrop-filter: blur(12px);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    padding: 2.5rem;
                    border-radius: 1.5rem;
                    width: 100%;
                    max-width: 420px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                }
                .auth-header { text-align: center; margin-bottom: 2rem; }
                .auth-logo { width: 120px; height: auto; margin-bottom: 1.5rem; filter: drop-shadow(0 0 8px rgba(16, 185, 129, 0.3)); }
                .auth-header h1 { font-size: 1.5rem; color: white; margin-bottom: 0.5rem; font-weight: 700; }
                .auth-subtitle { color: #9ca3af; font-size: 0.875rem; }
                
                .auth-form { display: flex; flex-direction: column; gap: 1.25rem; }
                .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
                .form-label { font-size: 0.875rem; color: #d1d5db; font-weight: 500; }
                
                .input-with-icon { position: relative; }
                .input-icon { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #6b7280; }
                .form-input {
                    padding: 0.75rem 1rem 0.75rem 2.75rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 0.75rem;
                    color: white;
                    width: 100%;
                    transition: border-color 0.2s, background 0.2s;
                }
                .form-input:focus { border-color: #10b981; background: rgba(16, 185, 129, 0.05); outline: none; }
                
                .btn-primary {
                    background: #10b981;
                    color: white;
                    padding: 0.875rem;
                    border-radius: 0.75rem;
                    font-weight: 700;
                    border: none;
                    cursor: pointer;
                    transition: transform 0.2s, background 0.2s, box-shadow 0.2s;
                }
                .btn-primary:hover { background: #059669; transform: translateY(-1px); box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.3); }
                .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

                .message-box { padding: 0.75rem 1rem; border-radius: 0.75rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem; font-size: 0.875rem; }
                .message-success { background: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.2); }
                .message-error { background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.2); }
            `}</style>
        </div>
    );
}
