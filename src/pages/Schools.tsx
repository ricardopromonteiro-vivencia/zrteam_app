import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Building2, MapPin, Plus, Edit2, Trash2, CheckCircle, HelpCircle } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Corrigir ícone padrão do Leaflet que desaparece no build/react
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

function LocationPicker({ onLocationSelect, position }: { onLocationSelect: (lat: number, lng: number) => void, position: [number, number] }) {
    useMapEvents({
        click(e) {
            onLocationSelect(e.latlng.lat, e.latlng.lng);
        },
    });
    return position ? <Marker position={position} /> : null;
}

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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const schoolData = {
            name: editingSchool.name,
            latitude: parseFloat(editingSchool.latitude),
            longitude: parseFloat(editingSchool.longitude),
            radius_meters: parseInt(editingSchool.radius_meters)
        };

        let error;
        if (editingSchool.id) {
            const { error: updateError } = await supabase
                .from('schools')
                .update(schoolData)
                .eq('id', editingSchool.id);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('schools')
                .insert(schoolData);
            error = insertError;
        }

        if (!error) {
            setEditingSchool(null);
            loadSchools();
        } else {
            alert('Erro ao guardar: ' + error.message);
        }
        setLoading(false);
    };

    return (
        <div className="schools-page animate-fade-in">
            <header className="page-header">
                <div className="header-info">
                    <h1 className="page-title">Gestão de Escolas</h1>
                    <p className="page-subtitle">Adiciona e gere as localizações das academias ZR Team.</p>
                </div>
                <button className="btn-primary" onClick={() => setEditingSchool({ name: '', latitude: 41.3833, longitude: -8.7667, radius_meters: 50 })}>
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
                                    <HelpCircle size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {loading && !editingSchool && <p className="loading-text">A carregar escolas...</p>}

            {/* Modal/Form */}
            {editingSchool && (
                <div className="modal-overlay">
                    <div className="modal-content school-modal">
                        <h2>{editingSchool.id ? 'Editar Escola' : 'Nova Escola'}</h2>
                        <form onSubmit={handleSave} className="school-form">
                            <div className="form-group">
                                <label className="form-label">Nome da Academia</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={editingSchool.name}
                                    onChange={e => setEditingSchool({ ...editingSchool, name: e.target.value })}
                                    required
                                    placeholder="Ex: ZR Team Fafe"
                                />
                            </div>

                            <div className="map-container-wrapper">
                                <label className="form-label">Localização (Clica no mapa)</label>
                                <div className="leaflet-map-box">
                                    <MapContainer
                                        center={[editingSchool.latitude, editingSchool.longitude]}
                                        zoom={15}
                                        style={{ height: '300px', width: '100%', borderRadius: '0.75rem' }}
                                    >
                                        <TileLayer
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            attribution='&copy; OpenStreetMap contributors'
                                        />
                                        <LocationPicker
                                            position={[editingSchool.latitude, editingSchool.longitude]}
                                            onLocationSelect={(lat, lng) => setEditingSchool({ ...editingSchool, latitude: lat, longitude: lng })}
                                        />
                                        <Circle
                                            center={[editingSchool.latitude, editingSchool.longitude]}
                                            radius={editingSchool.radius_meters}
                                            pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.2 }}
                                        />
                                    </MapContainer>
                                </div>
                                <div className="form-row coords-row">
                                    <div className="coord-item">Lat: {parseFloat(editingSchool.latitude).toFixed(6)}</div>
                                    <div className="coord-item">Lng: {parseFloat(editingSchool.longitude).toFixed(6)}</div>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Raio de Check-in: <strong>{editingSchool.radius_meters} metros</strong></label>
                                <input
                                    type="range"
                                    min="20"
                                    max="500"
                                    step="5"
                                    className="form-range"
                                    value={editingSchool.radius_meters}
                                    onChange={e => setEditingSchool({ ...editingSchool, radius_meters: parseInt(e.target.value) })}
                                />
                            </div>

                            <div className="modal-actions">
                                <button type="button" className="btn-secondary" onClick={() => setEditingSchool(null)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading}>
                                    {loading ? 'A guardar...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style>{`
        .schools-page { max-width: 1200px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; }
        .page-subtitle { color: var(--text-muted); font-size: 0.875rem; }
        
        .loading-text { text-align: center; color: var(--primary); margin-top: 2rem; }

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
          transition: transform 0.2s;
        }
        .school-card:hover { transform: translateY(-3px); border-color: var(--primary); }
        
        .school-header {
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        .school-icon {
          color: var(--primary);
          background: rgba(16, 185, 129, 0.1);
          padding: 0.5rem;
          border-radius: 0.75rem;
        }
        .school-details {
          font-size: 0.875rem;
          color: var(--text-muted);
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }
        .radius-tag {
          background: rgba(16, 185, 129, 0.1);
          color: var(--primary);
          padding: 0.25rem 0.75rem;
          border-radius: 9999px;
          display: inline-flex; align-items: center; width: fit-content; font-weight: 600; font-size: 0.75rem;
        }
        .school-details p { display: flex; align-items: center; gap: 0.5rem; }
        
        .school-actions {
          display: flex; gap: 0.5rem; margin-top: 1rem; padding-top: 1rem;
          border-top: 1px solid var(--border);
        }
        .icon-btn {
          background: none; border: 1px solid var(--border); padding: 0.5rem; border-radius: 0.5rem;
          cursor: pointer; color: var(--text-muted); transition: all 0.2s;
          display: flex; align-items: center; justify-content: center;
        }
        .icon-btn.edit:hover { background: rgba(59, 130, 246, 0.1); color: #3b82f6; border-color: #3b82f6; }
        .icon-btn.delete:hover { background: rgba(239, 68, 68, 0.1); color: var(--danger); border-color: var(--danger); }
        .icon-btn.delete.confirming { background: var(--danger); color: white; border-color: var(--danger); }

        /* Modal Styles */
        .modal-overlay {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0,0,0,0.8); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center;
          z-index: 1000; padding: 1rem;
        }
        .modal-content.school-modal {
          background: var(--bg-card); border: 1px solid var(--border);
          padding: 2rem; border-radius: 1.5rem; width: 100%; max-width: 600px;
          max-height: 90vh; overflow-y: auto;
        }
        
        .school-form { display: flex; flex-direction: column; gap: 1.5rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-label { font-size: 0.875rem; color: var(--text-muted); font-weight: 500; }
        .form-input {
          background: rgba(255,255,255,0.05); border: 1px solid var(--border);
          border-radius: 0.75rem; padding: 0.75rem 1rem; color: white;
        }
        
        .leaflet-map-box { border: 2px solid var(--border); border-radius: 0.75rem; overflow: hidden; }
        .coords-row { display: flex; gap: 1rem; margin-top: 0.5rem; }
        .coord-item { font-size: 0.75rem; color: var(--primary); font-family: monospace; }
        
        .form-range {
            width: 100%; height: 6px; background: var(--border); border-radius: 3px;
            appearance: none; outline: none; transition: 0.2s;
        }
        .form-range::-webkit-slider-thumb {
            appearance: none; width: 18px; height: 18px; background: var(--primary);
            border-radius: 50%; cursor: pointer;
        }

        .modal-actions {
          display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem;
        }
      `}</style>
        </div>
    );
}
