import { useOutletContext } from 'react-router-dom';
import { Activity, Trophy, Calendar } from 'lucide-react';

// Regras de progressão simples (seguindo a tabela Faixa Roxa: 375 aulas, etc)
// Para o exemplo geral:
const GRADUATION_RULES: Record<string, { totalForNextBelt: number, classesPerDegree: number, nextBelt: string }> = {
    'Branca': { totalForNextBelt: 120, classesPerDegree: 25, nextBelt: 'Azul' },
    'Azul': { totalForNextBelt: 250, classesPerDegree: 55, nextBelt: 'Roxa' },
    'Roxa': { totalForNextBelt: 375, classesPerDegree: 85, nextBelt: 'Marrom' },
    'Marrom': { totalForNextBelt: 500, classesPerDegree: 115, nextBelt: 'Preta' },
    'Preta': { totalForNextBelt: 1000, classesPerDegree: 200, nextBelt: 'Coral' }
};

export default function Dashboard() {
    const { profile } = useOutletContext<{ profile: any }>();

    if (!profile) return null;

    const rule = GRADUATION_RULES[profile.belt] || GRADUATION_RULES['Branca'];

    // Lógica de progressão
    const progressPercent = Math.min(100, Math.round((profile.attended_classes / rule.totalForNextBelt) * 100));
    const classesUntilNextDegree = rule.classesPerDegree - (profile.attended_classes % rule.classesPerDegree);
    const classesUntilNextBelt = rule.totalForNextBelt - profile.attended_classes;

    if (profile.role === 'Admin' || profile.role === 'Professor') {
        return (
            <div className="dashboard">
                <h1 className="page-title">Visão Geral - {profile.role}</h1>
                <div className="stats-grid">
                    <div className="stat-card">
                        <Activity className="stat-icon text-primary" />
                        <div className="stat-content">
                            <h3>Aulas Hoje</h3>
                            <p className="stat-value">3</p>
                        </div>
                    </div>
                    <div className="stat-card">
                        <Trophy className="stat-icon text-primary" />
                        <div className="stat-content">
                            <h3>Alunos Ativos</h3>
                            <p className="stat-value">42</p>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Dashboard do Atleta
    return (
        <div className="dashboard animate-fade-in">
            <h1 className="page-title">O Teu Treino</h1>

            <div className="stats-grid">
                <div className="stat-card">
                    <Activity className="stat-icon text-primary" />
                    <div className="stat-content">
                        <h3>Total de Presenças</h3>
                        <p className="stat-value">{profile.attended_classes}</p>
                    </div>
                </div>
                <div className="stat-card">
                    <Calendar className="stat-icon text-primary" />
                    <div className="stat-content">
                        <h3>Aulas esta Semana</h3>
                        <p className="stat-value">2</p>
                    </div>
                </div>
            </div>

            <div className="progression-card">
                <div className="progression-header">
                    <div>
                        <h2 className="progression-title">Progressão: Faixa {profile.belt}</h2>
                        <p className="progression-subtitle">Atualmente com {profile.degrees} Graus</p>
                    </div>
                    <div className="belt-badge">
                        <span className={`belt-color belt-${profile.belt.toLowerCase()}`}></span>
                    </div>
                </div>

                <div className="progress-bar-container">
                    <div className="progress-bar-track">
                        <div
                            className="progress-bar-fill"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                    <div className="progress-labels">
                        <span>{profile.attended_classes} Aulas</span>
                        <span>{rule.totalForNextBelt} Aulas para Faixa {rule.nextBelt}</span>
                    </div>
                </div>

                <div className="next-milestone">
                    <p>Faltam <strong>{classesUntilNextDegree}</strong> aulas para o próximo grau.</p>
                    <p>Faltam <strong>{classesUntilNextBelt}</strong> aulas para a Faixa {rule.nextBelt}.</p>
                </div>
            </div>

            <style>{`
        .dashboard {
          max-width: 1000px;
          margin: 0 auto;
        }
        .page-title {
          font-size: 1.875rem;
          font-weight: 700;
          margin-bottom: 2rem;
          color: white;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        .stat-card {
          background-color: var(--bg-card);
          padding: 1.5rem;
          border-radius: 1rem;
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .stat-icon {
          width: 48px;
          height: 48px;
          padding: 12px;
          border-radius: 0.75rem;
          background-color: rgba(16, 185, 129, 0.1);
          color: var(--primary);
        }
        .stat-content h3 {
          font-size: 0.875rem;
          color: var(--text-muted);
          font-weight: 500;
          margin-bottom: 0.25rem;
        }
        .stat-value {
          font-size: 1.5rem;
          font-weight: 700;
          color: var(--text-main);
        }
        .progression-card {
          background-color: var(--bg-card);
          padding: 2rem;
          border-radius: 1rem;
          border: 1px solid var(--border);
        }
        .progression-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2rem;
        }
        .progression-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 0.25rem;
        }
        .progression-subtitle {
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        .belt-badge {
          width: 60px;
          height: 12px;
          border-radius: 4px;
          background-color: #222;
          border: 1px solid #444;
          overflow: hidden;
        }
        .belt-color {
          display: block;
          width: 100%;
          height: 100%;
        }
        .belt-branca { background-color: #fff; }
        .belt-azul { background-color: #2563eb; }
        .belt-roxa { background-color: #9333ea; }
        .belt-marrom { background-color: #78350f; }
        .belt-preta { background-color: #000; }

        .progress-bar-track {
          height: 12px;
          background-color: #374151;
          border-radius: 9999px;
          overflow: hidden;
          margin-bottom: 0.5rem;
        }
        .progress-bar-fill {
          height: 100%;
          background-color: var(--primary);
          border-radius: 9999px;
          transition: width 1s ease-out;
        }
        .progress-labels {
          display: flex;
          justify-content: space-between;
          font-size: 0.875rem;
          color: var(--text-muted);
          margin-bottom: 1.5rem;
        }
        .next-milestone {
          background-color: rgba(16, 185, 129, 0.05);
          border-radius: 0.5rem;
          padding: 1rem;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }
        .next-milestone p {
          margin-bottom: 0.5rem;
          color: var(--text-main);
        }
        .next-milestone p:last-child {
          margin-bottom: 0;
        }
        .next-milestone strong {
          color: var(--primary);
        }
      `}</style>
        </div>
    );
}
