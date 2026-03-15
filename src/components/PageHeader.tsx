import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  actions?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, icon: Icon, actions }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-title">
        <Icon size={32} className="header-icon" />
        <div>
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
      
      <style>{`
        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
          flex-wrap: wrap;
          gap: 1rem;
        }
        
        .page-header-title {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        
        .header-icon {
          color: var(--primary);
        }
        
        .page-header-title h1 {
          margin: 0;
          font-size: 1.75rem;
          color: white;
        }
        
        .page-header-title p {
          margin: 0.25rem 0 0 0;
          color: var(--text-muted);
          font-size: 0.875rem;
        }
        
        .page-header-actions {
          display: flex;
          gap: 0.75rem;
        }
      `}</style>
    </div>
  );
}
