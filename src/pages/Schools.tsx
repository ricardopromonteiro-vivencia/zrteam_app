import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, MapPin, Plus, Edit2, Trash2, CheckCircle, XCircle } from 'lucide-react';

export default function Schools() {
    const [schools, setSchools] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingSchool, setEditingSchool] = useState<any>(null);
    const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

    useEffect(() => {
        loadSchools();
    }, []);

    async function loadSchools() {
        setLoading(true);
        const { data } = await supabase.from('schools').select('*').order('name');
        if (data) setSchools(data);
        setLoading(false);
    }

    const handleDelete = async (id: string) => {
        if (confirmDelete === id) {
            const { error } = await supabase.from('schools').delete().eq('id', id);
            if (!error) loadSchools();
            setConfirmDelete(null);
        } else {
            setConfirmDelete(id);
        }
    };

    return (
        <div className="schools-page animate-fade-in">
            <header className="page-header">
                <div className="header-info">
                    <h1 className="page-title">Gestão de Escolas</h1>
                    <p className="page-subtitle">Adiciona e gere as localizações das academias ZR Team.</p>
                </div>
                <button className="btn-primary" onClick={() => setEditingSchool({ name: '', latitude: 0, longitude: 0, radius_meters: 50 })}>
                    <Plus size={20} /> Nova Escola
                </button>
            </header>

            {/* Listagem de Escolas */}
            <div className="schools-grid">
                {schools.map(school => (
                    <div key={school.id} className="school-card">
                        <div className="school-header">
                            <div className="school-icon"><Building2 size={24} /></div>
                            <h3>{school.name}</h3>
                        </div>
                        <div className="school-details">
                            <p><MapPin size={16} /> Lat: {school.latitude.toFixed(4)}, Lng: {school.longitude.toFixed(4)}</p>
                            <p className="radius-tag">Raio: {school.radius_meters}m</p>
                        </div>
                        <div className="school-actions">
                            <button className="icon-btn edit" onClick={() => setEditingSchool(school)}>
                                <Edit2 size={18} />
                            </button>
                            <button
                                className={`icon-btn delete ${confirmDelete === school.id ? 'confirming' : ''}`}
                                onClick={() => handleDelete(school.id)}
                            >
                                {confirmDelete === school.id ? <CheckCircle size={18} /> : <Trash2 size={18} />}
                            </button>
                            {confirmDelete === school.id && (
                                <button className="icon-btn cancel" onClick={() => setConfirmDelete(null)}>
                                    <XCircle size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {loading && <p>A carregar escolas...</p>}

            {/* Modal/Form (Simplificado para este exemplo - embutir Google Maps seria o próximo passo) */}
            {editingSchool && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h2>{editingSchool.id ? 'Editar Escola' : 'Nova Escola'}</h2>
                        {/* Formulário aqui... */}
                        <p className="map-placeholder">
                            [Mapa do Google Maps será embutido aqui para selecionar {editingSchool.name}]
                        </p>
                        <div className="modal-actions">
                            <button className="btn-secondary" onClick={() => setEditingSchool(null)}>Cancelar</button>
                            <button className="btn-primary">Guardar</button>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
        .schools-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.5rem;
          margin-top: 2rem;
        }
        .school-card {
          background-color: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 1rem;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .school-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .school-icon {
          color: var(--primary);
        }
        .school-details {
          font-size: 0.875rem;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }
        .radius-tag {
          background: rgba(16, 185, 129, 0.1);
          color: var(--primary);
          padding: 0.15rem 0.5rem;
          border-radius: 4px;
          display: inline-block;
          width: fit-content;
        }
        .school-actions {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .icon-btn {
          background: none;
          border: none;
          padding: 0.5rem;
          border-radius: 0.5rem;
          cursor: pointer;
          color: var(--text-muted);
          transition: all 0.2s;
        }
        .icon-btn.edit:hover { background: rgba(59, 130, 246, 0.1); color: #3b82f6; }
        .icon-btn.delete:hover { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .icon-btn.delete.confirming { background: var(--danger); color: white; }
        .icon-btn.cancel:hover { background: rgba(255, 255, 255, 0.1); }
      `}</style>
        </div>
    );
}
