import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { Folder, Plus, Trash2, ExternalLink } from 'lucide-react';
import PageHeader from '../components/PageHeader';

interface Profile {
  id: string;
  role: string;
}

interface DocumentInfo {
  id: string;
  title: string;
  link_url: string;
  created_at: string;
  created_by: string;
}

export default function Documents() {
  const { profile } = useOutletContext<{ profile: Profile }>();
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  
  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile) {
      setIsAdmin(profile.role === 'Admin');
      fetchDocuments();
    }
  }, [profile]);

  async function fetchDocuments() {
    setLoading(true);
    const { data, error } = await supabase
      .from('documents')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setDocuments(data);
    }
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !linkUrl.trim()) return;

    setSaving(true);
    const { error } = await supabase
      .from('documents')
      .insert({
        title,
        link_url: linkUrl,
        created_by: profile.id
      });

    if (error) {
      setFeedback({ type: 'error', msg: 'Erro ao adicionar documento: ' + error.message });
    } else {
      setFeedback({ type: 'success', msg: 'Documento adicionado com sucesso!' });
      setIsModalOpen(false);
      setTitle('');
      setLinkUrl('');
      fetchDocuments();
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 3000);
  }

  async function handleDelete(id: string) {
    if (!confirm('Tens a certeza que queres apagar este documento?')) return;
    
    const { error } = await supabase
      .from('documents')
      .delete()
      .eq('id', id);

    if (error) {
      setFeedback({ type: 'error', msg: 'Erro ao apagar: ' + error.message });
    } else {
      setFeedback({ type: 'success', msg: 'Documento apagado.' });
      fetchDocuments();
    }
    setTimeout(() => setFeedback(null), 3000);
  }

  const actions = isAdmin ? (
    <button className="btn-primary" onClick={() => setIsModalOpen(true)}>
      <Plus size={20} /> Adicionar Documento
    </button>
  ) : undefined;

  return (
    <div className="page-container">
      <PageHeader 
        title="Documentos" 
        subtitle="Regulamentos, PDFs e ficheiros úteis"
        icon={Folder}
        actions={actions}
      />

      {feedback && (
        <div className={`feedback-alert ${feedback.type}`}>
          {feedback.msg}
        </div>
      )}

      {loading ? (
        <div className="loading-state">A carregar documentos...</div>
      ) : documents.length === 0 ? (
        <div className="empty-state">
          <Folder size={48} className="empty-icon" />
          <p>Nenhum documento disponível no momento.</p>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map(doc => (
            <div key={doc.id} className="document-card">
              <div className="document-icon">
                <Folder size={24} color="#10b981" />
              </div>
              <div className="document-info">
                <h3>{doc.title}</h3>
                <span className="document-date">{new Date(doc.created_at).toLocaleDateString('pt-PT')}</span>
              </div>
              <div className="document-actions">
                <a 
                  href={doc.link_url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="btn-download"
                  title="Abrir Documento"
                >
                  <ExternalLink size={18} /> Aceder
                </a>
                {isAdmin && (
                  <button 
                    onClick={() => handleDelete(doc.id)} 
                    className="btn-delete-doc"
                    title="Apagar Documento"
                  >
                    <Trash2 size={18} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Adicionar Documento */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Adicionar Documento</h2>
              <button 
                 className="close-btn" 
                 onClick={() => setIsModalOpen(false)}
                 disabled={saving}
              >
                &times;
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="document-form">
              <div className="form-group">
                <label>Título do Documento</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Regulamento Interno ZR Team"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  disabled={saving}
                />
              </div>
              
              <div className="form-group">
                <label>URL / Link do Ficheiro</label>
                <input
                  type="url"
                  required
                  placeholder="Ex: https://drive.google.com/..."
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  disabled={saving}
                />
                <span className="form-help">Cola aqui o link onde o documento está hospedado (Google Drive, Dropbox, etc). Não esquecer de garantir que o link é público.</span>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primary" disabled={saving}>
                  {saving ? 'A guardar...' : 'Guardar Documento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        .documents-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
          gap: 1.5rem;
          margin-top: 1.5rem;
        }

        .document-card {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1rem;
          padding: 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          transition: all 0.2s;
        }

        .document-card:hover {
          border-color: rgba(16, 185, 129, 0.4);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        }

        .document-icon {
          background: rgba(16, 185, 129, 0.1);
          padding: 1rem;
          border-radius: 0.75rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .document-info {
          flex: 1;
        }

        .document-info h3 {
          margin: 0 0 0.25rem;
          font-size: 1rem;
          color: white;
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
        }

        .document-date {
          font-size: 0.75rem;
          color: var(--text-muted);
        }

        .document-actions {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .btn-download {
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          background: rgba(255,255,255,0.05);
          color: white;
          padding: 0.5rem 0.75rem;
          border-radius: 0.5rem;
          font-size: 0.875rem;
          text-decoration: none;
          transition: all 0.2s;
        }

        .btn-download:hover {
          background: rgba(255,255,255,0.1);
        }

        .btn-delete-doc {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid transparent;
          padding: 0.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s;
        }

        .btn-delete-doc:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: rgba(239, 68, 68, 0.3);
        }

        .document-form .form-group {
          margin-bottom: 1.5rem;
        }

        .document-form .form-group label {
          display: block;
          margin-bottom: 0.5rem;
          color: var(--text-muted);
          font-size: 0.875rem;
        }

        .document-form .form-group input {
          width: 100%;
          padding: 0.75rem 1rem;
          background: var(--bg-dark);
          border: 1px solid var(--border);
          border-radius: 0.5rem;
          color: white;
          font-family: inherit;
        }
        
        .document-form .form-group input:focus {
          outline: none;
          border-color: var(--primary);
        }

        .document-form .form-help {
          display: block;
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: var(--text-muted);
        }
        
        .document-form .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
        }
      `}</style>
    </div>
  );
}
