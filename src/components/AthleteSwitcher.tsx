import React from 'react';
import { User, Users, ChevronDown, Check, Clock } from 'lucide-react';

interface AthleteSwitcherProps {
  athletes: any[];
  activeAthlete: any;
  onSelectAthlete: (athleteId: string) => void;
  label?: string;
  className?: string;
}

export default function AthleteSwitcher({
  athletes = [],
  activeAthlete,
  onSelectAthlete,
  label = 'Atleta Ativo',
  className = '',
}: AthleteSwitcherProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Fechar ao clicar fora
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!athletes || athletes.length <= 1) {
    // Se só existe 1 atleta, apenas mostramos um indicador discreto
    return null;
  }

  return (
    <div className={`athlete-switcher-wrapper ${className}`} ref={containerRef}>
      <div className="athlete-switcher-card">
        <div className="athlete-switcher-header">
          <div className="switcher-label">
            <Users size={15} className="text-primary" />
            <span>{label}</span>
          </div>
          <button
            type="button"
            className="athlete-switcher-btn"
            onClick={() => setIsOpen(!isOpen)}
            aria-expanded={isOpen}
            title="Comutar de Atleta"
          >
            <div className="current-athlete-info">
              <span className="current-name">
                {activeAthlete?.full_name || 'Selecionar Atleta'}
              </span>
              <span className="current-meta">
                {activeAthlete?.belt || 'Branco'}
                {activeAthlete?.degrees !== undefined ? ` · ${activeAthlete.degrees}° Grau` : ''}
                {activeAthlete?.needs_validation && (
                  <span className="badge-pending-mini">
                    <Clock size={10} /> Pendente
                  </span>
                )}
              </span>
            </div>
            <ChevronDown
              size={18}
              className={`dropdown-arrow ${isOpen ? 'open' : ''}`}
            />
          </button>
        </div>

        {isOpen && (
          <div className="athlete-dropdown-menu animate-fade-in">
            <div className="dropdown-title">Comutar Atleta da Conta</div>
            {athletes.map((athlete) => {
              const isSelected = athlete.id === activeAthlete?.id;
              const isPending = athlete.needs_validation;

              return (
                <button
                  key={athlete.id}
                  type="button"
                  className={`athlete-option ${isSelected ? 'selected' : ''}`}
                  onClick={() => {
                    onSelectAthlete(athlete.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="option-avatar">
                    <User size={16} />
                  </div>
                  <div className="option-details">
                    <div className="option-name">
                      {athlete.full_name}
                      {athlete.guardian_id ? (
                        <span className="dependent-tag">Dependente</span>
                      ) : (
                        <span className="principal-tag">Conta</span>
                      )}
                    </div>
                    <div className="option-sub">
                      {athlete.belt} · {athlete.degrees ?? 0}° Grau
                      {isPending && (
                        <span className="option-pending-tag">
                          <Clock size={10} /> Aguarda Aprovação
                        </span>
                      )}
                    </div>
                  </div>
                  {isSelected && <Check size={18} className="check-icon" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <style>{`
        .athlete-switcher-wrapper {
          position: relative;
          z-index: 40;
          margin-bottom: 1.25rem;
          width: 100%;
        }

        .athlete-switcher-card {
          background: linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(5, 150, 105, 0.03) 100%);
          border: 1px solid rgba(16, 185, 129, 0.25);
          border-radius: 0.85rem;
          padding: 0.65rem 1rem;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
        }

        .athlete-switcher-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .switcher-label {
          display: flex;
          align-items: center;
          gap: 0.4rem;
          font-size: 0.78rem;
          font-weight: 700;
          color: var(--primary);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .athlete-switcher-btn {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.85rem;
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 0.6rem;
          padding: 0.45rem 0.85rem;
          color: white;
          cursor: pointer;
          min-width: 220px;
          transition: all 0.2s;
        }

        .athlete-switcher-btn:hover {
          border-color: var(--primary);
          background: rgba(255, 255, 255, 0.05);
        }

        .current-athlete-info {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          text-align: left;
        }

        .current-name {
          font-weight: 700;
          font-size: 0.9rem;
          color: white;
        }

        .current-meta {
          font-size: 0.72rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .badge-pending-mini {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          background: rgba(245, 158, 11, 0.15);
          color: #f59e0b;
          border: 1px solid rgba(245, 158, 11, 0.3);
          border-radius: 9999px;
          padding: 0.1rem 0.4rem;
          font-size: 0.65rem;
          font-weight: 700;
        }

        .dropdown-arrow {
          color: var(--text-muted);
          transition: transform 0.2s ease;
        }

        .dropdown-arrow.open {
          transform: rotate(180deg);
          color: var(--primary);
        }

        .athlete-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          right: 0;
          left: 0;
          background: #1a1a1a;
          border: 1px solid var(--border);
          border-radius: 0.85rem;
          padding: 0.5rem;
          box-shadow: 0 15px 35px rgba(0, 0, 0, 0.6);
          z-index: 50;
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .dropdown-title {
          padding: 0.4rem 0.75rem;
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          margin-bottom: 0.2rem;
        }

        .athlete-option {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding: 0.65rem 0.85rem;
          border-radius: 0.5rem;
          border: 1px solid transparent;
          background: transparent;
          color: white;
          cursor: pointer;
          width: 100%;
          text-align: left;
          transition: all 0.15s;
        }

        .athlete-option:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .athlete-option.selected {
          background: rgba(16, 185, 129, 0.12);
          border-color: rgba(16, 185, 129, 0.35);
        }

        .option-avatar {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid var(--border);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--primary);
          flex-shrink: 0;
        }

        .option-details {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }

        .option-name {
          font-size: 0.875rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .dependent-tag {
          font-size: 0.65rem;
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 9999px;
          padding: 0.05rem 0.35rem;
          font-weight: 600;
        }

        .principal-tag {
          font-size: 0.65rem;
          background: rgba(16, 185, 129, 0.15);
          color: var(--primary);
          border: 1px solid rgba(16, 185, 129, 0.3);
          border-radius: 9999px;
          padding: 0.05rem 0.35rem;
          font-weight: 600;
        }

        .option-sub {
          font-size: 0.72rem;
          color: var(--text-muted);
          display: flex;
          align-items: center;
          gap: 0.4rem;
          flex-wrap: wrap;
        }

        .option-pending-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.2rem;
          color: #f59e0b;
          font-weight: 600;
          font-size: 0.7rem;
        }

        .check-icon {
          color: var(--primary);
          flex-shrink: 0;
        }

        @media (max-width: 640px) {
          .athlete-switcher-header {
            flex-direction: column;
            align-items: stretch;
          }
          .athlete-switcher-btn {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}

