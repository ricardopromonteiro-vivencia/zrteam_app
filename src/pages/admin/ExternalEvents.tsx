import { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Plus, Trash2, ExternalLink, Trophy, Calendar, Link as LinkIcon } from 'lucide-react';

interface ExternalEvent {
  id: string;
  name: string;
  event_date: string;
  link_url: string;
  created_at: string;
}

export default function ExternalEvents() {
  const { profile } = useOutletContext<{ profile: any }>();
  const [events, setEvents] = useState<ExternalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [formError, setFormError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  async function fetchEvents() {
    setLoading(true);
    const { data } = await supabase
      .from('external_events')
      .select('*')
      .order('event_date', { ascending: true });
    setEvents(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchEvents();
  }, []);

  if (profile?.role !== 'Admin') {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
        Acesso restrito a Administradores.
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');

    if (!name.trim() || !eventDate || !linkUrl.trim()) {
      setFormError('Todos os campos são obrigatórios.');
      return;
    }

    // Validação básica do URL
    try {
      new URL(linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`);
    } catch {
      setFormError('O weblink não é válido. Exemplo: https://evento.pt');
      return;
    }

    setSubmitting(true);
    const normalizedUrl = linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}`;

    const { error } = await supabase.from('external_events').insert({
      name: name.trim(),
      event_date: eventDate,
      link_url: normalizedUrl,
      created_by: profile.id,
    });

    if (error) {
      setFormError('Erro ao criar evento: ' + error.message);
      setSubmitting(false);
      return;
    }

    setName('');
    setEventDate('');
    setLinkUrl('');
    setShowForm(false);
    setSubmitting(false);
    fetchEvents();
  }

  async function handleDelete(id: string) {
    setDeleteId(id);
    const { error } = await supabase.from('external_events').delete().eq('id', id);
    if (!error) {
      setEvents(prev => prev.filter(e => e.id !== id));
    }
    setDeleteId(null);
  }

  const futureEvents = events.filter(e => e.event_date >= today);
  const pastEvents = events.filter(e => e.event_date < today);

  return (
    <div className="external-events-page">
      <header className="page-header">
        <div>
          <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <Trophy size={28} style={{ color: 'var(--primary)' }} />
            Eventos Externos
          </h1>
          <p style={{ color: 'var(--text-muted)', marginTop: '-1rem', fontSize: '0.9rem' }}>
            Campeonatos, torneios e eventos externos — visíveis no Dashboard de todos os utilizadores.
          </p>
        </div>
        <button
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
          onClick={() => setShowForm(v => !v)}
        >
          <Plus size={18} />
          Novo Evento
        </button>
      </header>

      {/* Formulário */}
      {showForm && (
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid rgba(16,185,129,0.3)',
          borderRadius: '1rem',
          padding: '1.5rem',
          marginBottom: '2rem',
          boxShadow: '0 0 20px rgba(16,185,129,0.05)',
        }}>
          <h3 style={{ margin: '0 0 1.25rem', fontSize: '1rem', fontWeight: 700, color: 'var(--primary)' }}>
            ➕ Novo Evento Externo
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">
                Nome do Evento *
              </label>
              <input
                className="form-input"
                type="text"
                placeholder="Ex: Campeonato Nacional de Jiu-Jitsu"
                value={name}
                onChange={e => setName(e.target.value)}
                maxLength={120}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">
                  <Calendar size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                  Data *
                </label>
                <input
                  className="form-input"
                  type="date"
                  value={eventDate}
                  onChange={e => setEventDate(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  <LinkIcon size={14} style={{ display: 'inline', marginRight: '0.3rem' }} />
                  Weblink *
                </label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="https://evento.pt"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                />
              </div>
            </div>

            {formError && (
              <p style={{ color: 'var(--danger)', fontSize: '0.85rem', margin: 0 }}>⚠️ {formError}</p>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => { setShowForm(false); setFormError(''); }}
              >
                Cancelar
              </button>
              <button type="submit" className="btn-primary" disabled={submitting}>
                {submitting ? 'A guardar...' : '✓ Guardar Evento'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          A carregar eventos...
        </div>
      ) : (
        <>
          {/* Eventos Futuros */}
          <section style={{ marginBottom: '2rem' }}>
            <h2 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              📅 Próximos Eventos ({futureEvents.length})
            </h2>
            {futureEvents.length === 0 ? (
              <div style={{
                background: 'var(--bg-card)', border: '1px dashed var(--border)',
                borderRadius: '1rem', padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem'
              }}>
                Ainda não há eventos futuros. Cria o primeiro acima. 🥋
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {futureEvents.map(ev => <EventCard key={ev.id} ev={ev} onDelete={handleDelete} deleteId={deleteId} />)}
              </div>
            )}
          </section>

          {/* Eventos Passados */}
          {pastEvents.length > 0 && (
            <section>
              <h2 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                🗂️ Eventos Passados ({pastEvents.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {[...pastEvents].reverse().map(ev => <EventCard key={ev.id} ev={ev} onDelete={handleDelete} deleteId={deleteId} past />)}
              </div>
            </section>
          )}
        </>
      )}

      <style>{`
        .external-events-page { max-width: 800px; margin: 0 auto; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem; }
      `}</style>
    </div>
  );
}

function EventCard({ ev, onDelete, deleteId, past = false }: {
  ev: ExternalEvent;
  onDelete: (id: string) => void;
  deleteId: string | null;
  past?: boolean;
}) {
  const date = new Date(ev.event_date + 'T12:00:00');
  const formatted = date.toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' });

  const diffDays = (() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return Math.ceil((date.getTime() - t.getTime()) / (1000 * 60 * 60 * 24));
  })();

  const countdown = past
    ? `Realizado a ${formatted}`
    : diffDays === 0
    ? 'Hoje!'
    : diffDays === 1
    ? 'Amanhã'
    : `Daqui a ${diffDays} dias`;

  return (
    <div style={{
      background: 'var(--bg-card)',
      border: `1px solid ${past ? 'var(--border)' : 'rgba(16,185,129,0.2)'}`,
      borderRadius: '0.75rem',
      padding: '1rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      gap: '1rem',
      opacity: past ? 0.65 : 1,
      transition: 'opacity 0.2s',
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '0.75rem', flexShrink: 0,
        background: past ? 'rgba(255,255,255,0.04)' : 'rgba(16,185,129,0.08)',
        border: `1px solid ${past ? 'var(--border)' : 'rgba(16,185,129,0.2)'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.4rem',
      }}>
        🏆
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'white', marginBottom: '0.2rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {ev.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>📅 {formatted}</span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 700, padding: '0.15rem 0.5rem',
            borderRadius: '9999px',
            background: past ? 'rgba(255,255,255,0.05)' : diffDays <= 7 ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
            color: past ? 'var(--text-muted)' : diffDays <= 7 ? '#fca5a5' : 'var(--primary)',
            border: `1px solid ${past ? 'transparent' : diffDays <= 7 ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          }}>
            {countdown}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
        <a
          href={ev.link_url}
          target="_blank"
          rel="noreferrer"
          title="Abrir link"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.3rem',
            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
            borderRadius: '0.5rem', padding: '0.4rem 0.75rem',
            color: '#93c5fd', fontSize: '0.78rem', fontWeight: 600, textDecoration: 'none',
            transition: 'background 0.2s',
          }}
        >
          <ExternalLink size={13} /> Ver
        </a>
        <button
          onClick={() => onDelete(ev.id)}
          disabled={deleteId === ev.id}
          title="Eliminar evento"
          style={{
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: '0.5rem', padding: '0.4rem 0.6rem',
            color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center',
            opacity: deleteId === ev.id ? 0.5 : 1,
            transition: 'background 0.2s',
          }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
