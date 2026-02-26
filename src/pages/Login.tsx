import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { LogIn, UserPlus } from 'lucide-react';

export default function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            if (isLogin) {
                const { error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                });
                if (error) throw error;
            } else {
                const { error } = await supabase.auth.signUp({
                    email,
                    password,
                    options: {
                        data: {
                            full_name: fullName,
                            role: 'Atleta' // Role default, Admin/Prof será manual na DB se aplicável
                        }
                    }
                });
                if (error) throw error;
                // Se sucesso e exigir confirmação de e-mail...
                alert("Conta criada. Confirma o teu email se aplicável, ou faz login.");
                setIsLogin(true);
            }
        } catch (err: any) {
            setError(err.message || 'Ocorreu um erro durante a autenticação.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card animate-fade-in">
                <div className="auth-header">
                    <h1 className="auth-title">Plataforma Jiu-Jitsu</h1>
                    <p className="auth-subtitle">
                        {isLogin ? 'Bem-vindo de volta ao tatame.' : 'Cria a tua conta e começa a treinar.'}
                    </p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleAuth}>
                    {!isLogin && (
                        <div className="form-group">
                            <label className="form-label" htmlFor="fullName">Nome Completo</label>
                            <input
                                id="fullName"
                                type="text"
                                className="form-input"
                                placeholder="Ex: João Silva"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                required={!isLogin}
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

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? (
                            'A processar...'
                        ) : isLogin ? (
                            <><LogIn size={20} /> Entrar</>
                        ) : (
                            <><UserPlus size={20} /> Registar</>
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>
                        {isLogin ? 'Não tens conta?' : 'Já tens conta?'}
                    </span>{' '}
                    <button
                        type="button"
                        onClick={() => { setIsLogin(!isLogin); setError(null); }}
                        style={{ color: 'var(--primary)', fontWeight: 500 }}
                    >
                        {isLogin ? 'Regista-te' : 'Faz Login'}
                    </button>
                </div>
            </div>
        </div>
    );
}
