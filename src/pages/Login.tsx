import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus, KeyRound } from 'lucide-react';

import logo from '../assets/logo.png';

type Mode = 'login' | 'register' | 'recover';

export default function Login() {
    // ... (mantenho o resto igual nas linhas interiores se possível, mas aqui vou substituir o header)
    const [mode, setMode] = useState<Mode>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [acceptedTerms, setAcceptedTerms] = useState(false);

    function switchMode(m: Mode) {
        setMode(m);
        setError(null);
        setSuccess(null);
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            if (mode === 'login') {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            } else if (mode === 'register') {
                if (!acceptedTerms) {
                    setError('Deves aceitar os Termos e Condições para continuar.');
                    setLoading(false);
                    return;
                }
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: { full_name: fullName, role: 'Atleta' }
                    }
                });
                if (error) throw error;
                setSuccess('Conta criada com sucesso! Faz login para entrar.');
                switchMode('login');
            } else if (mode === 'recover') {
                const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                if (error) throw error;
                setSuccess('Email de recuperação enviado! Verifica a tua caixa de entrada.');
            }
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro. Tenta novamente.');
        } finally {
            setLoading(false);
        }
    };

    const titles: Record<Mode, string> = {
        login: 'Bem-vindo de volta ao tatame.',
        register: 'Cria a tua conta e começa a treinar.',
        recover: 'Recupera o acesso à tua conta.',
    };

    return (
        <div className="auth-container">
            <div className="auth-card animate-fade-in">
                <div className="auth-header">
                    <img src={logo} alt="ZR Team Logo" className="auth-logo" />
                    <p className="auth-subtitle">{titles[mode]}</p>
                </div>

                {error && <div className="error-message">{error}</div>}
                {success && <div className="success-message">{success}</div>}

                <form onSubmit={handleAuth}>
                    {mode === 'register' && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="fullName">Nome Completo</label>
                            <input
                                id="fullName"
                                type="text"
                                className="form-input"
                                placeholder="Ex: João Silva"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    <div className="form-group">
                        <label className="form-label" htmlFor="email">E-mail</label>
                        <input
                            id="email"
                            type="email"
                            className="form-input"
                            placeholder="teuemail@exemplo.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>

                    {mode !== 'recover' && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="password">Palavra-passe</label>
                            <input
                                id="password"
                                type="password"
                                className="form-input"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                    )}

                    {mode === 'register' && (
                        <div className="form-group checkbox-group">
                            <input
                                id="terms"
                                type="checkbox"
                                checked={acceptedTerms}
                                onChange={(e) => setAcceptedTerms(e.target.checked)}
                                required
                            />
                            <label htmlFor="terms" className="checkbox-label">
                                Aceito os <a href="/termos" target="_blank" rel="noreferrer">Termos e Condições</a>
                            </label>
                        </div>
                    )}

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'A processar...' : mode === 'login' ? (
                            <><LogIn size={20} /> Entrar</>
                        ) : mode === 'register' ? (
                            <><UserPlus size={20} /> Registar</>
                        ) : (
                            <><KeyRound size={20} /> Enviar Email de Recuperação</>
                        )}
                    </button>
                </form>

                <div className="auth-links">
                    {mode === 'login' && (
                        <>
                            <span style={{ color: 'var(--text-muted)' }}>Não tens conta?</span>{' '}
                            <button type="button" className="link-btn" onClick={() => switchMode('register')}>
                                Regista-te
                            </button>
                            <span style={{ color: 'var(--border)', margin: '0 0.5rem' }}>|</span>
                            <button type="button" className="link-btn" onClick={() => switchMode('recover')}>
                                Esqueci a palavra-passe
                            </button>
                        </>
                    )}
                    {(mode === 'register' || mode === 'recover') && (
                        <>
                            <span style={{ color: 'var(--text-muted)' }}>Já tens conta?</span>{' '}
                            <button type="button" className="link-btn" onClick={() => switchMode('login')}>
                                Faz Login
                            </button>
                        </>
                    )}
                </div>

                <div className="zr-footer">
                    <p>© {new Date().getFullYear()} Todos os direitos reservados</p>
                    <p>Desenvolvido por <strong>Monteirismo</strong></p>
                </div>
            </div>

            <style>{`
                .auth-logo {
                    width: 120px;
                    height: 120px;
                    margin: 0 auto 1.5rem;
                    display: block;
                    border-radius: 50%;
                    border: 2px solid var(--primary);
                    padding: 4px;
                    background: white;
                }
                .success-message {
                    background: rgba(16,185,129,0.15);
                    color: #6ee7b7;
                    border: 1px solid rgba(16,185,129,0.3);
                    border-radius: 0.5rem;
                    padding: 0.75rem 1rem;
                    margin-bottom: 1rem;
                    font-size: 0.875rem;
                }
                .auth-links {
                    margin-top: 1.5rem;
                    text-align: center;
                    font-size: 0.875rem;
                }
                .zr-footer {
                    margin-top: 2rem;
                    text-align: center;
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    border-top: 1px solid var(--border);
                    padding-top: 1.5rem;
                    line-height: 1.5;
                }
                .zr-footer strong {
                    color: var(--primary);
                }
                .link-btn {
                    color: var(--primary);
                    font-weight: 500;
                    background: none;
                    border: none;
                    cursor: pointer;
                    padding: 0;
                    font-size: inherit;
                }
                .link-btn:hover { text-decoration: underline; }

                .checkbox-group {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    margin-bottom: 1.5rem;
                }
                .checkbox-group input {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: var(--primary);
                }
                .checkbox-label {
                    font-size: 0.875rem;
                    color: var(--text-muted);
                    cursor: pointer;
                }
                .checkbox-label a {
                    color: var(--primary);
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
}
