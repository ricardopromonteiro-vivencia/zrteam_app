import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { ShoppingBag, CheckCircle, Clock, XCircle, Search, User, Building, Calendar, ChevronDown, ChevronUp, FileDown, ClipboardList, Trash2 } from 'lucide-react';

interface Order {
    id: string;
    created_at: string;
    status: 'pendente' | 'pago' | 'cancelado' | 'entregue';
    total_amount: number;
    notes: string | null;
    profiles: { full_name: string };
    schools: { name: string };
}

interface GroupedOrders {
    schoolName: string;
    orders: Order[];
}

export default function OrderManagement() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        let query = supabase
            .from('store_orders')
            .select(`
                *,
                profiles(full_name),
                schools(name)
            `)
            .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
            if (statusFilter === 'especial') {
                query = query.ilike('notes', 'encomenda_especial%');
            } else {
                query = query.eq('status', statusFilter);
            }
        }

        const { data } = await query;
        if (data) setOrders(data as Order[]);
        setLoading(false);
    }, [statusFilter]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    async function updateOrderStatus(orderId: string, newStatus: string) {
        if (!confirm(`Mudar estado para ${newStatus}?`)) return;
        setLoading(true);
        const { error } = await supabase
            .from('store_orders')
            .update({ status: newStatus })
            .eq('id', orderId);
        
        if (!error) {
            fetchOrders();
            if (selectedOrder?.id === orderId) {
                const { data } = await supabase
                    .from('store_orders')
                    .select('*, profiles(full_name), schools(name)')
                    .eq('id', orderId)
                    .single();
                setSelectedOrder(data);
            }
        }
        setLoading(false);
    }

    async function deleteOrder(orderId: string) {
        if (!confirm('Esta ação é irreversível. Tens a certeza ABSOLUTA que desejas eliminar esta encomenda? (Também será eliminada da BD)')) return;
        
        setLoading(true);
        const { error } = await supabase
            .from('store_orders')
            .delete()
            .eq('id', orderId);
            
        if (!error) {
            fetchOrders();
            if (selectedOrder?.id === orderId) {
                setSelectedOrder(null);
            }
        } else {
            alert('Erro ao eliminar encomenda. Verifica se tens permissões.');
            console.error(error);
        }
        setLoading(false);
    }

    async function viewOrderDetails(order: Order) {
        setLoading(true);
        const { data: items } = await supabase
            .from('store_order_items')
            .select(`
                *,
                store_products(name, image_url),
                store_product_variants(size, color)
            `)
            .eq('order_id', order.id);
        
        setSelectedOrder({ ...order, items });
        setLoading(false);
    }

    const toggleGroup = (schoolName: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(schoolName)) next.delete(schoolName);
            else next.add(schoolName);
            return next;
        });
    };

    // Agrupar por escola
    const filteredOrders = orders.filter(o =>
        o.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        o.schools?.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const groupedOrders: GroupedOrders[] = filteredOrders.reduce((acc: GroupedOrders[], order) => {
        const schoolName = order.schools?.name || 'Sem escola';
        const group = acc.find(g => g.schoolName === schoolName);
        if (group) {
            group.orders.push(order);
        } else {
            acc.push({ schoolName, orders: [order] });
        }
        return acc;
    }, []).sort((a, b) => a.schoolName.localeCompare(b.schoolName));

    const getStatusStyle = (status: string) => {
        switch(status) {
            case 'pendente': return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', icon: Clock };
            case 'pago': return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', icon: CheckCircle };
            case 'entregue': return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', icon: ShoppingBag };
            case 'cancelado': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', icon: XCircle };
            default: return { bg: 'gray', color: 'white', icon: Clock };
        }
    };

    const isSpecialRequest = (order: Order) => order.notes?.startsWith('encomenda_especial');

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow) return;

        const now = new Date().toLocaleDateString('pt-PT');
        let html = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Encomendas ZR Team — ${now}</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body { font-family: Arial, sans-serif; font-size: 12px; color: #111; padding: 24px; }
                h1 { font-size: 20px; margin-bottom: 4px; }
                .subtitle { color: #666; margin-bottom: 24px; font-size: 11px; }
                .school-block { margin-bottom: 28px; page-break-inside: avoid; }
                .school-header { background: #f3f4f6; padding: 8px 12px; border-left: 4px solid #10b981; font-size: 13px; font-weight: bold; margin-bottom: 8px; border-radius: 2px; display: flex; justify-content: space-between; }
                .school-count { font-weight: normal; color: #555; }
                table { width: 100%; border-collapse: collapse; }
                th { background: #e5e7eb; padding: 7px 10px; text-align: left; font-size: 11px; color: #444; }
                td { padding: 7px 10px; border-bottom: 1px solid #e5e7eb; }
                .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 10px; font-weight: bold; }
                .badge-pendente { background: #fef3c7; color: #92400e; }
                .badge-pago { background: #d1fae5; color: #065f46; }
                .badge-entregue { background: #dbeafe; color: #1e40af; }
                .badge-cancelado { background: #fee2e2; color: #991b1b; }
                .badge-especial { background: #ffedd5; color: #9a3412; }
                .total-row { font-weight: bold; font-size: 11px; color: #111; margin-top: 4px; text-align: right; padding-right: 10px; }
                .grand-total { border-top: 2px solid #111; padding-top: 12px; text-align: right; font-size: 14px; font-weight: bold; }
                @media print { body { padding: 16px; } }
            </style>
        </head>
        <body>
            <h1>📦 Encomendas ZR Team</h1>
            <p class="subtitle">Gerado em ${now} · ${filteredOrders.length} encomenda(s) · Filtro: ${statusFilter === 'all' ? 'Todos os estados' : statusFilter}</p>
        `;

        let grandTotal = 0;
        for (const group of groupedOrders) {
            const groupTotal = group.orders.reduce((s, o) => s + o.total_amount, 0);
            grandTotal += groupTotal;
            html += `
            <div class="school-block">
                <div class="school-header">
                    <span>🏫 ${group.schoolName}</span>
                    <span class="school-count">${group.orders.length} encomenda(s) · ${groupTotal.toFixed(2)}€</span>
                </div>
                <table>
                    <thead><tr>
                        <th>Atleta</th>
                        <th>Data</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Notas</th>
                    </tr></thead>
                    <tbody>
            `;
            for (const o of group.orders) {
                const isSpecial = o.notes?.startsWith('encomenda_especial');
                const badgeClass = isSpecial ? 'badge-especial' : `badge-${o.status}`;
                const statusLabel = isSpecial ? '⚠ Pedido Especial' : (o.status.charAt(0).toUpperCase() + o.status.slice(1));
                html += `<tr>
                    <td>${o.profiles?.full_name || '-'}</td>
                    <td>${new Date(o.created_at).toLocaleDateString('pt-PT')}</td>
                    <td>${o.total_amount.toFixed(2)}€</td>
                    <td><span class="badge ${badgeClass}">${statusLabel}</span></td>
                    <td>${isSpecial ? (o.notes?.replace('encomenda_especial | ', '') || '') : '-'}</td>
                </tr>`;
            }
            html += `</tbody></table></div>`;
        }

        html += `<div class="grand-total">Total Geral: ${grandTotal.toFixed(2)}€</div>`;
        html += `</body></html>`;

        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => printWindow.print(), 400);
    };

    return (
        <div className="order-management-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Gestão de Encomendas</h1>
                    <p className="page-subtitle">Acompanha e processa as compras dos teus alunos.</p>
                </div>
                <button className="export-pdf-btn" onClick={handleExportPDF} title="Exportar PDF">
                    <FileDown size={18} /> Exportar PDF
                </button>
            </header>

            <div className="orders-filters">
                <div className="search-box">
                    <Search size={20} />
                    <input placeholder="Procurar por atleta ou escola..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="filter-chips">
                    <button className={`chip chip-all ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
                        Todas
                    </button>
                    <button className={`chip chip-pendente ${statusFilter === 'pendente' ? 'active' : ''}`} onClick={() => setStatusFilter('pendente')}>
                        Pendentes
                    </button>
                    <button className={`chip chip-pago ${statusFilter === 'pago' ? 'active' : ''}`} onClick={() => setStatusFilter('pago')}>
                        Pagas
                    </button>
                    <button className={`chip chip-entregue ${statusFilter === 'entregue' ? 'active' : ''}`} onClick={() => setStatusFilter('entregue')}>
                        Entregues
                    </button>
                    <button className={`chip chip-cancelado ${statusFilter === 'cancelado' ? 'active' : ''}`} onClick={() => setStatusFilter('cancelado')}>
                        Canceladas
                    </button>
                    <button className={`chip chip-especial ${statusFilter === 'especial' ? 'active' : ''}`} onClick={() => setStatusFilter('especial')}>
                        ⚠ Especiais
                    </button>
                </div>
            </div>

            {loading && <div className="loading-msg">A carregar...</div>}

            <div className="orders-groups">
                {groupedOrders.length === 0 && !loading && (
                    <div className="empty-orders">Nenhuma encomenda encontrada.</div>
                )}
                {groupedOrders.map(group => {
                    const isCollapsed = collapsedGroups.has(group.schoolName);
                    const groupTotal = group.orders.reduce((s, o) => s + o.total_amount, 0);
                    return (
                        <div key={group.schoolName} className="school-group">
                            <div className="school-group-header" onClick={() => toggleGroup(group.schoolName)}>
                                <div className="group-title">
                                    <Building size={18} />
                                    <span>{group.schoolName}</span>
                                    <span className="group-badge">{group.orders.length}</span>
                                </div>
                                <div className="group-meta">
                                    <span className="group-total">{groupTotal.toFixed(2)}€</span>
                                    {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                                </div>
                            </div>

                            {!isCollapsed && (
                                <div className="group-orders">
                                    {group.orders.map(order => {
                                        const style = getStatusStyle(order.status);
                                        const StatusIcon = style.icon;
                                        const special = isSpecialRequest(order);
                                        return (
                                            <div key={order.id} className={`order-row ${special ? 'order-row-special' : ''}`} onClick={() => viewOrderDetails(order)}>
                                                <div className="order-main-info">
                                                    <div className="user-avatar-placeholder">
                                                        {special ? <ClipboardList size={20} /> : <User size={20} />}
                                                    </div>
                                                    <div className="info-text">
                                                        <h3>{order.profiles?.full_name}</h3>
                                                        {special && (
                                                            <span className="special-badge">⚠ Pedido Especial: {order.notes?.replace('encomenda_especial | ', '')}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="order-meta-row">
                                                    <span className="order-date"><Calendar size={14} /> {new Date(order.created_at).toLocaleDateString('pt-PT')}</span>
                                                    <span className="order-amount">{order.total_amount.toFixed(2)}€</span>
                                                </div>
                                                <div className="order-status-tag" style={{ backgroundColor: style.bg, color: style.color }}>
                                                    <StatusIcon size={14} />
                                                    {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {selectedOrder && (
                <div className="order-modal-overlay">
                    <div className="order-modal modal-content">
                        <div className="modal-header">
                            <h2>Detalhes da Encomenda #{selectedOrder.id.slice(0, 8)}</h2>
                            <button onClick={() => setSelectedOrder(null)} className="close-btn"><XCircle size={24} /></button>
                        </div>
                        
                        <div className="order-modal-body">
                            {isSpecialRequest(selectedOrder) && (
                                <div className="special-order-banner">
                                    <ClipboardList size={20} />
                                    <div>
                                        <strong>O Atleta tem interesse num artigo sem stock selecionado na Loja!</strong>
                                        <div>Tamanho/Cor: {selectedOrder.notes?.replace('encomenda_especial | ', '')}</div>
                                    </div>
                                </div>
                            )}

                            <div className="action-buttons-top" style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1rem' }}>
                                <button onClick={() => deleteOrder(selectedOrder.id)} className="btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--danger)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                                    <Trash2 size={16} /> Eliminar Encomenda
                                </button>
                            </div>

                            <div className="order-details-grid">
                                <div className="details-card">
                                    <h3>Informação do Cliente</h3>
                                    <p><strong>Atleta:</strong> {selectedOrder.profiles?.full_name}</p>
                                    <p><strong>Escola:</strong> {selectedOrder.schools?.name}</p>
                                    <p><strong>Data:</strong> {new Date(selectedOrder.created_at).toLocaleString('pt-PT')}</p>
                                </div>

                                <div className="details-card">
                                    <h3>Estado & Pagamento</h3>
                                    <div className="status-selector">
                                        <label>Alterar Estado:</label>
                                        <div className="status-buttons">
                                            <button className={`status-btn pendente ${selectedOrder.status === 'pendente' ? 'active' : ''}`} onClick={() => updateOrderStatus(selectedOrder.id, 'pendente')}>Pendente</button>
                                            <button className={`status-btn pago ${selectedOrder.status === 'pago' ? 'active' : ''}`} onClick={() => updateOrderStatus(selectedOrder.id, 'pago')}>Paga</button>
                                            <button className={`status-btn entregue ${selectedOrder.status === 'entregue' ? 'active' : ''}`} onClick={() => updateOrderStatus(selectedOrder.id, 'entregue')}>Entregue</button>
                                            <button className={`status-btn cancelado ${selectedOrder.status === 'cancelado' ? 'active' : ''}`} onClick={() => updateOrderStatus(selectedOrder.id, 'cancelado')}>Cancelada</button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="order-items-list">
                                <h3>Artigos Encomendados</h3>
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Artigo</th>
                                            <th>Opções</th>
                                            <th>Qtd</th>
                                            <th>Preço</th>
                                            <th>Subtotal</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedOrder.items?.map((item: any) => (
                                            <tr key={item.id}>
                                                <td className="item-cell">
                                                    {item.store_products?.image_url && <img src={item.store_products.image_url} alt="" />}
                                                    <span>{item.store_products?.name}</span>
                                                </td>
                                                <td>{item.store_product_variants?.size} / {item.store_product_variants?.color}</td>
                                                <td>{item.quantity}</td>
                                                <td>{item.unit_price.toFixed(2)}€</td>
                                                <td>{(item.quantity * item.unit_price).toFixed(2)}€</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr>
                                            <td colSpan={4} align="right"><strong>Total:</strong></td>
                                            <td><strong>{selectedOrder.total_amount.toFixed(2)}€</strong></td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .page-header { display: flex; justify-content: space-between; align-items: flex-start; }
                .export-pdf-btn { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.25rem; background: linear-gradient(135deg, #6366f1, #4f46e5); color: white; border: none; border-radius: 0.75rem; cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s; white-space: nowrap; }
                .export-pdf-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(99,102,241,0.4); }

                .orders-filters { display: flex; flex-direction: column; gap: 1.25rem; margin-bottom: 2rem; background: var(--bg-card); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border); }
                @media (min-width: 1024px) {
                    .orders-filters { flex-direction: row; align-items: flex-start; }
                }
                .search-box { width: 100%; display: flex; align-items: center; gap: 0.75rem; background: var(--bg-dark); padding: 0.75rem 1rem; border-radius: 0.5rem; border: 1px solid var(--border); }
                @media (min-width: 1024px) {
                    .search-box { flex: 1; max-width: 400px; }
                }
                .search-box input { background: none; border: none; color: white; width: 100%; outline: none; }
                
                .filter-chips { width: 100%; display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: flex-start; }
                @media (min-width: 1024px) {
                    .filter-chips { flex: 2; }
                }
                .chip { padding: 0.5rem 1rem; border-radius: 99px; font-size: 0.8rem; font-weight: 600; cursor: pointer; border: 1px solid transparent; transition: all 0.2s; background: var(--bg-dark); color: var(--text-muted); white-space: nowrap; flex: 1; text-align: center; min-width: max-content; }
                @media (min-width: 480px) {
                    .chip { flex: 0 1 auto; }
                }
                .chip:hover { filter: brightness(1.2); }
                
                .chip-all.active { background: white; color: black; }
                .chip-pendente.active { background: rgba(245,158,11,0.15); color: #f59e0b; border-color: rgba(245,158,11,0.3); }
                .chip-pago.active { background: rgba(16,185,129,0.15); color: #10b981; border-color: rgba(16,185,129,0.3); }
                .chip-entregue.active { background: rgba(59,130,246,0.15); color: #3b82f6; border-color: rgba(59,130,246,0.3); }
                .chip-cancelado.active { background: rgba(239,68,68,0.15); color: #ef4444; border-color: rgba(239,68,68,0.3); }
                .chip-especial.active { background: rgba(249,115,22,0.15); color: #f97316; border-color: rgba(249,115,22,0.3); }

                .loading-msg { text-align: center; color: var(--text-muted); padding: 2rem; }
                .empty-orders { text-align: center; color: var(--text-muted); padding: 3rem; background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border); }

                .orders-groups { display: flex; flex-direction: column; gap: 1.25rem; }

                .school-group { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; }
                .school-group-header { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.2s; }
                .school-group-header:hover { background: rgba(255,255,255,0.04); }
                .group-title { display: flex; align-items: center; gap: 0.75rem; color: white; font-weight: 700; font-size: 1.05rem; }
                .group-badge { background: var(--primary); color: #000; font-size: 0.75rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; }
                .group-meta { display: flex; align-items: center; gap: 1rem; color: var(--text-muted); }
                .group-total { font-weight: 700; color: white; }

                .group-orders { display: flex; flex-direction: column; }
                .order-row { display: flex; align-items: center; gap: 1.5rem; padding: 1rem 1.25rem; border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.2s; }
                .order-row:last-child { border-bottom: none; }
                .order-row:hover { background: rgba(255,255,255,0.03); }
                .order-row-special { border-left: 3px solid #f97316; }

                .order-main-info { display: flex; align-items: center; gap: 1rem; flex: 2; }
                .user-avatar-placeholder { width: 40px; height: 40px; border-radius: 50%; background: #1a1a1a; display: flex; align-items: center; justify-content: center; color: var(--text-muted); flex-shrink: 0; }
                .info-text h3 { margin: 0; color: white; font-size: 1rem; }
                .special-badge { font-size: 0.8rem; color: #f97316; margin-top: 2px; display: block; }

                .order-meta-row { flex: 1; display: flex; flex-direction: column; gap: 2px; }
                .order-date { display: flex; align-items: center; gap: 4px; font-size: 0.8rem; color: var(--text-muted); }
                .order-amount { font-size: 1rem; font-weight: 700; color: white; }
                .order-status-tag { display: flex; align-items: center; gap: 6px; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; white-space: nowrap; }

                .special-order-banner { background: rgba(249,115,22,0.1); border: 1px solid rgba(249,115,22,0.3); border-radius: 0.75rem; padding: 0.75rem 1rem; color: #f97316; display: flex; align-items: center; gap: 0.75rem; margin-bottom: 1.5rem; font-size: 0.9rem; }

                .order-modal { width: 95%; max-width: 800px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
                .order-modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; min-height: 0; }
                .order-details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; }
                .details-card { background: var(--bg-dark); padding: 1.25rem; border-radius: 0.75rem; border: 1px solid var(--border); }
                .details-card h3 { margin-top: 0; font-size: 1rem; color: var(--primary); margin-bottom: 1rem; }
                .details-card p { margin: 0.5rem 0; font-size: 0.95rem; }

                .status-selector label { display: block; margin-bottom: 0.75rem; font-size: 0.9rem; color: var(--text-muted); }
                .status-buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; }
                .status-btn { padding: 8px; border-radius: 6px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-muted); cursor: pointer; font-size: 0.85rem; font-weight: 600; }
                .status-btn.active.pendente { background: #f59e0b; color: #000; border-color: #f59e0b; }
                .status-btn.active.pago { background: #10b981; color: #000; border-color: #10b981; }
                .status-btn.active.entregue { background: #3b82f6; color: #fff; border-color: #3b82f6; }
                .status-btn.active.cancelado { background: #ef4444; color: #fff; border-color: #ef4444; }

                .order-items-list table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
                .order-items-list th { text-align: left; padding: 12px; border-bottom: 2px solid var(--border); color: var(--text-muted); font-size: 0.85rem; }
                .order-items-list td { padding: 12px; border-bottom: 1px solid var(--border); font-size: 0.95rem; }
                .item-cell { display: flex; align-items: center; gap: 12px; }
                .item-cell img { width: 40px; height: 40px; border-radius: 4px; object-fit: cover; }

                .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; display: flex; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
                .modal-header h2 { margin: 0; font-size: 1.2rem; }
            `}</style>
        </div>
    );
}
