import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useOutletContext } from 'react-router-dom';
import { CalendarDays, Plus, MapPin, Users, Calendar, Trash2, ArrowRight, Clock, Download, Edit2, Building2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Profile {
  id: string;
  role: string;
  school_id: string | null;
}

interface Event {
  id: string;
  title: string;
  description: string;
  location: string;
  school_id: string | null;
  capacity: number;
  registration_deadline: string;
  dates: string[];
  created_at: string;
  school?: { name: string };
  registrations?: { count: number }[];
  user_status?: string; // 'not_registered' | 'Pendente' | 'Pago'
}

interface Registration {
  id: string;
  user_id: string;
  event_id: string;
  payment_status: string;
  created_at: string;
  profiles: {
    full_name: string;
    belt: string;
    role: string;
    school: { name: string } | null;
  };
}

export default function Events() {
  const { profile } = useOutletContext<{ profile: Profile }>();
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<{ id: string, name: string }[]>([]);
  
  const canManage = profile.role === 'Admin' || profile.role === 'Professor Responsável';

  // Modal / Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', location: '', school_id: '',
    capacity: 0, registration_deadline: '', editMode: false, eventId: ''
  });
  const [eventDates, setEventDates] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error', msg: string } | null>(null);

  // Registrations Modal
  const [regsModalOpen, setRegsModalOpen] = useState(false);
  const [currentEvent, setCurrentEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);
  const [paymentFilter, setPaymentFilter] = useState('all'); // all, Pendente, Pago

  useEffect(() => {
    fetchData();
  }, [profile]);

  async function fetchData() {
    setLoading(true);
    
    // 1. Get Schools
    const { data: schoolsData } = await supabase.from('schools').select('id, name');
    if (schoolsData) setSchools(schoolsData);

    // 2. Get Events
    let query = supabase
      .from('events')
      .select('*, school:schools(name), registrations:event_registrations(count)')
      .order('dates', { ascending: true }); // A ordenar grosseiramente por datas

    if (profile.role !== 'Admin') {
      // Se não for Admin, só vê eventos da sua escola ou eventos gerais (school_id is null)
      query = query.or(`school_id.is.null,school_id.eq.${profile.school_id}`);
    }

    const { data: eventsData, error } = await query;
    
    if (eventsData) {
      // Get User Registrations
      const { data: userRegs } = await supabase
        .from('event_registrations')
        .select('event_id, payment_status')
        .eq('user_id', profile.id);
        
      const regsMap = (userRegs || []).reduce((acc: any, curr) => {
        acc[curr.event_id] = curr.payment_status;
        return acc;
      }, {});

      const processed = eventsData.map(e => ({
        ...e,
        user_status: regsMap[e.id] || 'not_registered'
      }));
      setEvents(processed);
    } else if (error) {
      console.error("Error fetching events:", error);
    }
    setLoading(false);
  }

  // --- CRUD Eventos ---

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    
    const validDates = eventDates.filter(d => d.trim() !== '');
    if (validDates.length === 0) {
      setFeedback({ type: 'error', msg: 'Adiciona pelo menos uma data.' });
      setSaving(false); return;
    }

    const payload = {
      title: form.title,
      description: form.description,
      location: form.location,
      school_id: form.school_id || null,
      capacity: form.capacity,
      registration_deadline: new Date(form.registration_deadline).toISOString(),
      dates: validDates,
      created_by: profile.id
    };

    let error;
    if (form.editMode) {
      const res = await supabase.from('events').update(payload).eq('id', form.eventId);
      error = res.error;
    } else {
      const res = await supabase.from('events').insert(payload);
      error = res.error;
    }

    if (error) {
      setFeedback({ type: 'error', msg: 'Erro: ' + error.message });
    } else {
      setFeedback({ type: 'success', msg: form.editMode ? 'Evento atualizado!' : 'Evento criado!' });
      setIsModalOpen(false);
      fetchData();
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 3000);
  }

  async function handleDeleteEvent(id: string) {
    if(!confirm('Apagar evento e TODAS as inscrições?')) return;
    const { error } = await supabase.from('events').delete().eq('id', id);
    if (!error) {
        setFeedback({ type: 'success', msg: 'Evento apagado.' });
        fetchData();
    }
    setTimeout(() => setFeedback(null), 3000);
  }

  function openEditModal(ev: Event) {
    setForm({
      title: ev.title, description: ev.description, location: ev.location, 
      school_id: ev.school_id || '', capacity: ev.capacity,
      registration_deadline: ev.registration_deadline.substring(0, 16), // Format for datetime-local
      editMode: true, eventId: ev.id
    });
    setEventDates(ev.dates);
    setIsModalOpen(true);
  }

  function openCreateModal() {
    setForm({
      title: '', description: '', location: '', school_id: '',
      capacity: 0, registration_deadline: '', editMode: false, eventId: ''
    });
    setEventDates(['']);
    setIsModalOpen(true);
  }

  // --- Inscrições ---

  async function handleRegister(eventId: string) {
    setSaving(true);
    const { error } = await supabase
      .from('event_registrations')
      .insert({ event_id: eventId, user_id: profile.id });
    
    if (!error) {
      setFeedback({ type: 'success', msg: 'Inscrição efetuada!' });
      fetchData();
    } else {
      setFeedback({ type: 'error', msg: 'Erro na inscrição: ' + error.message });
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 3000);
  }

  async function handleCancelRegistration(eventId: string) {
    if(!confirm('Queres cancelar a tua inscrição?')) return;
    setSaving(true);
    const { error } = await supabase
      .from('event_registrations')
      .delete()
      .eq('event_id', eventId)
      .eq('user_id', profile.id);
    
    if (!error) {
       setFeedback({ type: 'success', msg: 'Inscrição cancelada.' });
       fetchData();
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 3000);
  }

  // --- Gestão de Inscritos ---

  async function openRegistrations(ev: Event) {
    setCurrentEvent(ev);
    setRegistrations([]); // Limpar lista anterior
    setRegsModalOpen(true);
    setLoadingRegs(true);
    
    const { data, error } = await supabase
      .from('event_registrations')
      .select(`
        id, user_id, payment_status, created_at,
        profiles (full_name, belt, role, school:schools!profiles_school_id_fkey(name))
      `)
      .eq('event_id', ev.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching registrations:', error);
      alert('Erro ao carregar inscritos: ' + error.message);
    }

    if (data) {
      // O dado já deve vir com a key 'school' devido ao alias (school:schools!...)
      setRegistrations(data as any);
    }
    setLoadingRegs(false);
  }

  async function togglePaymentStatus(regId: string, currentStatus: string) {
    const newStatus = currentStatus === 'Pendente' ? 'Pago' : 'Pendente';
    const { error } = await supabase
      .from('event_registrations')
      .update({ payment_status: newStatus })
      .eq('id', regId);
      
    if (!error) {
      setRegistrations(regs => regs.map(r => r.id === regId ? { ...r, payment_status: newStatus } : r));
    }
  }

  // Exports
  const filteredRegs = registrations.filter(r => paymentFilter === 'all' || r.payment_status === paymentFilter);

  const exportPDF = () => {
    if (!currentEvent) return;
    const doc = new jsPDF();
    doc.text(`Inscritos - ${currentEvent.title}`, 14, 15);
    
    autoTable(doc, {
      head: [['Nome', 'Escola', 'Faixa', 'Estado Pgt.']],
      body: filteredRegs.map(r => [
        r.profiles.full_name, 
        r.profiles.school?.name || '---', 
        r.profiles.belt, 
        r.payment_status
      ]),
      startY: 20
    });
    doc.save(`Inscritos_${currentEvent.title.replace(/\s+/g, '_')}.pdf`);
  };

  const exportExcel = () => {
    if (!currentEvent) return;
    const data = filteredRegs.map(r => ({
      Nome: r.profiles.full_name,
      Escola: r.profiles.school?.name || '---',
      Faixa: r.profiles.belt,
      'Data Inscrição': new Date(r.created_at).toLocaleDateString(),
      'Estado Pagamento': r.payment_status
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inscritos");
    XLSX.writeFile(wb, `Inscritos_${currentEvent.title.replace(/\s+/g, '_')}.xlsx`);
  };


  return (
    <div className="page-container">
      <PageHeader 
        title="Eventos" 
        subtitle="Seminários, Graduações e Treinos Especiais"
        icon={CalendarDays}
        actions={canManage && (
          <button className="btn-primary" onClick={openCreateModal}>
            <Plus size={20} /> Criar Evento
          </button>
        )}
      />

      {feedback && <div className={`feedback-alert ${feedback.type}`}>{feedback.msg}</div>}

      {/* Lista de Eventos */}
      {loading ? (
         <div className="loading-state">A carregar eventos...</div>
      ) : events.length === 0 ? (
         <div className="empty-state">
           <CalendarDays size={48} className="empty-icon" />
           <p>Não há eventos agendados de momento.</p>
         </div>
      ) : (
         <div className="events-grid">
           {events.map(ev => {
             // Computed properties
             const isClosed = new Date(ev.registration_deadline) < new Date();
             const regsCount = ev.registrations?.[0]?.count || 0;
             const isFull = ev.capacity > 0 && regsCount >= ev.capacity;
             const isRegistered = ev.user_status !== 'not_registered';
             
             // Sorting dates and formatting
             const sortedDates = [...ev.dates].sort();
             const dateDisplay = sortedDates.length === 1 
                ? new Date(sortedDates[0]).toLocaleDateString()
                : `${new Date(sortedDates[0]).toLocaleDateString()} a ${new Date(sortedDates[sortedDates.length-1]).toLocaleDateString()}`;

             return (
               <div key={ev.id} className="event-card">
                 <div className="event-header">
                   <h3>{ev.title}</h3>
                   {isRegistered && <span className="badge badge-success">Inscrito</span>}
                 </div>
                 
                 <div className="event-details">
                   <p><Calendar size={16}/> {dateDisplay}</p>
                   <p><MapPin size={16}/> {ev.location}</p>
                   {canManage && <p><Building2 size={16}/> {ev.school?.name || 'Todas as Escolas'}</p>}
                   <p><Users size={16}/> {ev.capacity > 0 ? `${regsCount} / ${ev.capacity} Lotação` : `${regsCount} Inscritos`}</p>
                   <p><Clock size={16}/> Inscrições até {new Date(ev.registration_deadline).toLocaleString([], { dateStyle: 'short', timeStyle: 'short'})}</p>
                 </div>
                 
                 <p className="event-description">{ev.description}</p>
                 
                 <div className="event-footer">
                    {/* Botão de Registo do User */}
                    {!isRegistered && !isClosed && !isFull && (
                        <button onClick={() => handleRegister(ev.id)} className="btn-register" disabled={saving}>
                           Inscrever-me <ArrowRight size={16}/>
                        </button>
                    )}
                    {isRegistered && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span className={`status-badge ${ev.user_status === 'Pago' ? 'status-pago' : 'status-pendente'}`}>
                                {ev.user_status}
                            </span>
                            {!isClosed && (
                                <button onClick={() => handleCancelRegistration(ev.id)} className="btn-cancel-reg" disabled={saving}>
                                    Cancelar
                                </button>
                            )}
                        </div>
                    )}
                    {(isClosed || isFull) && !isRegistered && (
                        <span className="badge badge-danger">{isFull ? 'Esgotado' : 'Encerrado'}</span>
                    )}

                    {/* Acções Admin */}
                    {canManage && (
                        <div className="admin-actions">
                            <button className="btn-admin-view" onClick={() => openRegistrations(ev)} title="Ver Inscritos">
                                <Users size={18} />
                            </button>
                            <button className="btn-admin-edit" onClick={() => openEditModal(ev)} title="Editar Evento">
                                <Edit2 size={18} />
                            </button>
                            <button className="btn-admin-delete" onClick={() => handleDeleteEvent(ev.id)} title="Apagar Evento">
                                <Trash2 size={18} />
                            </button>
                        </div>
                    )}
                 </div>
               </div>
             );
           })}
         </div>
      )}

      {/* MODAL CRIAR/EDITAR EVENTO */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="modal-content large" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{form.editMode ? 'Editar Evento' : 'Criar Evento'}</h2>
              <button className="close-btn" onClick={() => setIsModalOpen(false)} disabled={saving}>&times;</button>
            </div>
            
            <form onSubmit={handleSaveEvent} className="event-form">
                <div className="form-row">
                    <div className="form-group" style={{ flex: 2 }}>
                        <label>Título / Nome do Evento</label>
                        <input type="text" required value={form.title} onChange={e => setForm({...form, title: e.target.value})} disabled={saving} />
                    </div>
                </div>

                <div className="form-group">
                    <label>Descrição / Programa</label>
                    <textarea rows={3} required value={form.description} onChange={e => setForm({...form, description: e.target.value})} disabled={saving} />
                </div>

                <div className="form-row">
                    <div className="form-group">
                        <label>Local / Morada</label>
                        <input type="text" required value={form.location} onChange={e => setForm({...form, location: e.target.value})} disabled={saving} />
                    </div>
                    <div className="form-group">
                        <label>Limitar a Escola</label>
                        <select value={form.school_id} onChange={e => setForm({...form, school_id: e.target.value})} disabled={saving}>
                            <option value="">Todas as Escolas</option>
                            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                </div>

                <div className="form-row">
                   <div className="form-group">
                        <label>Lotação (Inscritos)</label>
                        <input type="number" min={0} value={form.capacity} onChange={e => setForm({...form, capacity: +e.target.value})} disabled={saving} />
                        <span className="form-help">Coloca 0 para sem limite.</span>
                   </div>
                   <div className="form-group">
                        <label>Data Limite de Inscrição</label>
                        <input type="datetime-local" required value={form.registration_deadline} onChange={e => setForm({...form, registration_deadline: e.target.value})} disabled={saving} />
                   </div>
                </div>

                <div className="form-group">
                    <label>Datas do Evento</label>
                    {eventDates.map((d, i) => (
                        <div key={i} style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <input type="date" required value={d} onChange={e => {
                                const newD = [...eventDates];
                                newD[i] = e.target.value;
                                setEventDates(newD);
                            }} disabled={saving} />
                            {eventDates.length > 1 && (
                                <button type="button" className="btn-icon" onClick={() => setEventDates(eventDates.filter((_, idx) => idx !== i))}><Trash2 size={16}/></button>
                            )}
                        </div>
                    ))}
                    <button type="button" className="btn-secondary btn-sm" onClick={() => setEventDates([...eventDates, ''])} disabled={saving}>+ Adicionar Data</button>
                    <span className="form-help">Podes adicionar múltiplos dias (útil para seminários de fim de semana).</span>
                </div>

              <div className="form-actions">
                <button type="button" className="btn-secondary" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancelar</button>
                <button type="submit" className="btn-primary" disabled={saving}>{saving ? 'A guardar...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL VER INSCRITOS */}
      {regsModalOpen && currentEvent && (
        <div className="modal-overlay" onClick={() => setRegsModalOpen(false)}>
           <div className="modal-content large" onClick={e => e.stopPropagation()}>
               <div className="modal-header">
                  <h2>Inscritos: {currentEvent.title}</h2>
                  <button className="close-btn" onClick={() => setRegsModalOpen(false)}>&times;</button>
               </div>
               
               <div className="regs-toolbar">
                  <div className="filters">
                      <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)}>
                          <option value="all">Ver Todos</option>
                          <option value="Pendente">Apenas Pendentes</option>
                          <option value="Pago">Apenas Pagos</option>
                      </select>
                  </div>
                  <div className="export-actions">
                      <button className="btn-export excel" onClick={exportExcel}><Download size={16}/> Excel</button>
                      <button className="btn-export pdf" onClick={exportPDF}><Download size={16}/> PDF</button>
                  </div>
               </div>

               {loadingRegs ? (
                   <p>A carregar inscritos...</p>
               ) : (
                   <div className="table-container">
                       <table className="data-table">
                           <thead>
                               <tr>
                                   <th>Atleta</th>
                                   <th>Escola / Faixa</th>
                                   <th>Estado</th>
                                   <th>Pagamento</th>
                               </tr>
                           </thead>
                           <tbody>
                               {filteredRegs.map(reg => (
                                   <tr key={reg.id}>
                                       <td>
                                           <strong>{reg.profiles?.full_name || 'Utilizador Desconhecido'}</strong>
                                           <br/>
                                           <span className="text-muted">{reg.profiles?.role || '---'}</span>
                                       </td>
                                       <td>
                                           {reg.profiles?.school?.name || '---'}
                                           <br/>
                                           <span className="belt-chip" style={{ marginTop: '4px'}}>
                                               {reg.profiles?.belt || '---'}
                                           </span>
                                       </td>
                                       <td><span className={`status-badge ${reg.payment_status === 'Pago' ? 'status-pago' : 'status-pendente'}`}>{reg.payment_status}</span></td>
                                       <td>
                                          <button 
                                             className={`btn-toggle-payment ${reg.payment_status === 'Pago' ? 'is-paid' : ''}`}
                                             onClick={() => togglePaymentStatus(reg.id, reg.payment_status)}
                                          >
                                              {reg.payment_status === 'Pendente' ? 'Marcar Pago' : 'Marcar Pendente'}
                                          </button>
                                       </td>
                                   </tr>
                               ))}
                               {filteredRegs.length === 0 && (
                                   <tr>
                                       <td colSpan={4} className="text-center">Sem inscrições a mostrar.</td>
                                   </tr>
                               )}
                           </tbody>
                       </table>
                   </div>
               )}
           </div>
        </div>
      )}


      <style>{`
        .events-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 1.5rem; }
        .event-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
        .event-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
        .event-header h3 { margin: 0; font-size: 1.25rem; color: white; line-height: 1.3; }
        .event-details { display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 0.5rem; }
        .event-details p { margin: 0; display: flex; align-items: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.875rem; }
        .event-description { color: #d1d5db; font-size: 0.95rem; line-height: 1.5; margin: 0; flex: 1; }
        .event-footer { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border); }
        
        .btn-register { background: #10b981; color: white; border: none; padding: 0.6rem 1rem; border-radius: 0.5rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.2s; }
        .btn-register:hover:not(:disabled) { background: #059669; }
        .btn-cancel-reg { background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.4rem 0.8rem; border-radius: 0.5rem; font-size: 0.875rem; cursor: pointer; transition: all 0.2s; }
        .btn-cancel-reg:hover { background: rgba(239, 68, 68, 0.2); }
        
        .admin-actions { display: flex; gap: 0.5rem; }
        .admin-actions button { background: rgba(255,255,255,0.05); color: var(--text-muted); border: 1px solid transparent; padding: 0.5rem; border-radius: 0.5rem; cursor: pointer; display: flex; align-items: center; transition: all 0.2s; }
        .admin-actions button:hover { background: rgba(255,255,255,0.1); color: white; }
        .btn-admin-edit:hover { border-color: rgba(59,130,246,0.5); color: #3b82f6 !important; }
        .btn-admin-delete:hover { border-color: rgba(239,68,68,0.5); color: #ef4444 !important; }
        .btn-admin-view { color: #10b981 !important; border: 1px solid rgba(16,185,129,0.3) !important; }
        .btn-admin-view:hover { background: rgba(16,185,129,0.1) !important; }

        .badge-success { background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 0.25rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(16,185,129,0.3); }
        .badge-danger { background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 0.25rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; border: 1px solid rgba(239,68,68,0.3); }

        .status-badge { display: inline-block; padding: 0.3rem 0.6rem; border-radius: 1rem; font-size: 0.75rem; font-weight: 600; }
        .status-pago { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.3); }
        .status-pendente { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }

        .btn-toggle-payment { background: rgba(255,255,255,0.05); border: 1px solid var(--border); color: white; padding: 0.4rem 0.8rem; border-radius: 0.4rem; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; }
        .btn-toggle-payment.is-paid { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.2); }
        .btn-toggle-payment:hover { filter: brightness(1.2); }

        .regs-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem; }
        .regs-toolbar select { background: var(--bg-dark); color: white; border: 1px solid var(--border); padding: 0.5rem; border-radius: 0.5rem; outline: none; }
        .export-actions { display: flex; gap: 0.5rem; }
        .btn-export { display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; }
        .btn-export.excel { background: rgba(16,185,129,0.15); color: #10b981; border-color: rgba(16,185,129,0.3); }
        .btn-export.pdf { background: rgba(239,68,68,0.15); color: #ef4444; border-color: rgba(239,68,68,0.3); }
        
        /* Event Form Styles */
        .event-form .form-group { margin-bottom: 1.25rem; }
        .event-form .form-row { display: flex; gap: 1rem; flex-wrap: wrap; }
        .event-form .form-row > div { flex: 1; min-width: 200px; }
        .event-form label { display: block; margin-bottom: 0.5rem; color: var(--text-muted); font-size: 0.875rem; }
        .event-form input, .event-form select, .event-form textarea { width: 100%; padding: 0.75rem; background: var(--bg-dark); border: 1px solid var(--border); border-radius: 0.5rem; color: white; font-family: inherit; }
        .event-form .form-help { display: block; margin-top: 0.4rem; font-size: 0.75rem; color: #6b7280; }
        .event-form .form-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; border-top: 1px solid var(--border); padding-top: 1.5rem; }
      `}</style>
    </div>
  );
}
