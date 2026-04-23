import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import {
    Clock, CheckCircle, XCircle, ShoppingBag, ChevronRight,
    Hash, Calendar, CreditCard, ClipboardList, AlertCircle,
    ShoppingCart, Loader2, ArrowRight, PackageCheck
} from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';

interface Order {
    id: string;
    created_at: string;
    status: 'pendente' | 'pago' | 'cancelado' | 'entregue';
    total_amount: number;
    notes: string | null;
    items?: any[];
}

export default function MyOrders() {
    const { profile } = useOutletContext<any>() || {};
    const [orders, setOrders] = useState<Order[]>([]);
    const [specialRequests, setSpecialRequests] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const [convertingId, setConvertingId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'orders' | 'requests'>('orders');
    const navigate = useNavigate();

    const fetchMyOrders = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);

        const { data } = await supabase
            .from('store_orders')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false });

        if (data) {
            const regular = data.filter(o => !o.notes?.startsWith('encomenda_especial'));
            const specials = data.filter(o => o.notes?.startsWith('encomenda_especial'));
            setOrders(regular);
            setSpecialRequests(specials);
        }
        setLoading(false);
    }, [profile?.id]);

    useEffect(() => {
        fetchMyOrders();
    }, [fetchMyOrders]);

    // Verificar se alguma variante do pedido especial tem stock agora
    const checkVariantStock = async (order: Order): Promise<{ hasStock: boolean; variant?: any; product?: any }> => {
        const { data: items } = await supabase
            .from('store_order_items')
            .select(`
                *,
                store_products(id, name, price, image_url),
                store_product_variants(id, size, color, stock_quantity)
            `)
            .eq('order_id', order.id);

        if (!items || items.length === 0) return { hasStock: false };

        const itemWithStock = items.find(i => (i.store_product_variants?.stock_quantity || 0) > 0);
        if (itemWithStock) {
            return {
                hasStock: true,
                variant: itemWithStock.store_product_variants,
                product: itemWithStock.store_products
            };
        }
        return { hasStock: false };
    };

    // Carregar stock info para cada pedido especial
    const [stockInfo, setStockInfo] = useState<Record<string, { hasStock: boolean; variant?: any; product?: any }>>({});

    useEffect(() => {
        if (specialRequests.length === 0) return;
        const loadStockInfo = async () => {
            const results: Record<string, any> = {};
            for (const req of specialRequests) {
                results[req.id] = await checkVariantStock(req);
            }
            setStockInfo(results);
        };
        loadStockInfo();
    }, [specialRequests]);

    // Converter pedido especial em encomenda normal
    const convertToOrder = async (specialOrder: Order) => {
        if (!profile) return;
        setConvertingId(specialOrder.id);

        try {
            // Buscar os itens do pedido especial
            const { data: items } = await supabase
                .from('store_order_items')
                .select(`
                    *,
                    store_product_variants(id, size, color, stock_quantity)
                `)
                .eq('order_id', specialOrder.id);

            if (!items || items.length === 0) {
                alert('Erro: Não foi possível encontrar os artigos deste pedido.');
                setConvertingId(null);
                return;
            }

            const item = items[0];
            const variant = item.store_product_variants;

            if (!variant || variant.stock_quantity <= 0) {
                alert('De momento este artigo ainda não tem stock suficiente. Tenta mais tarde.');
                setConvertingId(null);
                return;
            }

            // Criar nova encomenda normal (sem notes especiais)
            const { data: newOrder, error: orderErr } = await supabase
                .from('store_orders')
                .insert({
                    user_id: profile.id,
                    school_id: profile.school_id,
                    total_amount: specialOrder.total_amount,
                    status: 'pendente',
                    notes: null
                })
                .select()
                .single();

            if (orderErr || !newOrder) {
                alert('Erro ao criar encomenda. Tenta novamente.');
                setConvertingId(null);
                return;
            }

            // Copiar os itens para a nova encomenda
            await supabase.from('store_order_items').insert({
                order_id: newOrder.id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity,
                unit_price: item.unit_price
            });

            // Apagar o aviso de stock correspondente (para não ficar como spam)
            const requestDetail = specialOrder.notes?.replace('encomenda_especial | ', '') || '';
            await supabase
                .from('announcements')
                .delete()
                .eq('target_user_id', profile.id)
                .eq('type', 'system')
                .ilike('content', `%${requestDetail}%`);

            // Apagar o pedido especial original (os items são apagados em cascata pela FK)
            const { error: deleteErr } = await supabase
                .from('store_orders')
                .delete()
                .eq('id', specialOrder.id);

            if (deleteErr) {
                console.error('Erro ao apagar pedido especial:', deleteErr);
            }

            alert('✅ Encomenda criada com sucesso! Paga na tua escola para confirmar.');
            fetchMyOrders();
            setActiveTab('orders');
        } catch (e) {
            alert('Ocorreu um erro inesperado. Tenta novamente.');
        } finally {
            setConvertingId(null);
        }
    };

    const viewOrderDetails = async (order: Order) => {
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
    };

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'pendente': return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', icon: Clock, label: 'Pendente' };
            case 'pago': return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', icon: CheckCircle, label: 'Pago' };
            case 'entregue': return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', icon: ShoppingBag, label: 'Entregue' };
            case 'cancelado': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', icon: XCircle, label: 'Cancelado' };
            default: return { bg: 'gray', color: 'white', icon: Clock, label: status };
        }
    };

    const hasAvailableRequests = Object.values(stockInfo).some(s => s.hasStock);
    const pendingRequests = specialRequests.filter(r => r.status === 'pendente' && !r.notes?.includes('[convertido]'));

    return (
        <div className="my-orders-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">As Minhas Encomendas</h1>
                    <p className="page-subtitle">Acompanha as tuas compras e pedidos sem stock.</p>
                </div>
            </header>

            {/* Tabs */}
            <div className="orders-tabs">
                <button
                    className={`tab-btn ${activeTab === 'orders' ? 'active' : ''}`}
                    onClick={() => setActiveTab('orders')}
                >
                    <ShoppingBag size={18} />
                    Encomendas
                    {orders.length > 0 && <span className="tab-count">{orders.length}</span>}
                </button>
                <button
                    className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => setActiveTab('requests')}
                >
                    <ClipboardList size={18} />
                    Pedidos Sem Stock
                    {pendingRequests.length > 0 && (
                        <span className={`tab-count ${hasAvailableRequests ? 'tab-count-alert' : ''}`}>
                            {pendingRequests.length}
                        </span>
                    )}
                </button>
            </div>

            {loading && (
                <div className="loading-box">
                    <Loader2 size={32} className="spin" />
                    <span>A carregar...</span>
                </div>
            )}

            {/* ─── TAB: Encomendas Normais ─── */}
            {!loading && activeTab === 'orders' && (
                orders.length === 0 ? (
                    <div className="empty-orders">
                        <ShoppingBag size={56} />
                        <h2>Ainda não tens encomendas</h2>
                        <p>Visita a nossa loja para veres os artigos disponíveis.</p>
                        <button className="btn-primary" onClick={() => navigate('/loja')}>
                            <ShoppingCart size={18} /> Ir para a Loja
                        </button>
                    </div>
                ) : (
                    <div className="orders-grid">
                        {orders.map(order => {
                            const style = getStatusStyle(order.status);
                            const StatusIcon = style.icon;
                            return (
                                <div key={order.id} className="order-card" onClick={() => viewOrderDetails(order)}>
                                    <div className="order-header">
                                        <div className="order-id">
                                            <Hash size={15} />
                                            <span>#{order.id.slice(0, 8)}</span>
                                        </div>
                                        <div className="order-status-badge" style={{ background: style.bg, color: style.color }}>
                                            <StatusIcon size={13} />
                                            {style.label}
                                        </div>
                                    </div>
                                    <div className="order-body">
                                        <div className="order-info"><Calendar size={15} /><span>{new Date(order.created_at).toLocaleDateString('pt-PT')}</span></div>
                                        <div className="order-info"><CreditCard size={15} /><span className="amount">{order.total_amount.toFixed(2)}€</span></div>
                                    </div>
                                    <div className="order-footer">
                                        <span>Ver Detalhes</span>
                                        <ChevronRight size={16} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* ─── TAB: Pedidos Sem Stock ─── */}
            {!loading && activeTab === 'requests' && (
                pendingRequests.length === 0 ? (
                    <div className="empty-orders">
                        <ClipboardList size={56} />
                        <h2>Nenhum pedido pendente</h2>
                        <p>Se pedires um artigo esgotado na loja, aparece aqui quando ficar disponível.</p>
                        <button className="btn-primary" onClick={() => navigate('/loja')}>
                            <ShoppingCart size={18} /> Ir para a Loja
                        </button>
                    </div>
                ) : (
                    <div className="requests-list">
                        {/* Banner de aviso se houver artigos disponíveis */}
                        {hasAvailableRequests && (
                            <div className="available-banner">
                                <PackageCheck size={22} />
                                <div>
                                    <strong>Temos boas notícias!</strong>
                                    <span>Um ou mais artigos que pediste estão agora disponíveis. Converte o pedido numa encomenda abaixo.</span>
                                </div>
                            </div>
                        )}

                        {pendingRequests.map(req => {
                            const info = stockInfo[req.id];
                            const isAvailable = info?.hasStock ?? false;
                            const detail = req.notes?.replace('encomenda_especial | ', '') || '';
                            const isConverting = convertingId === req.id;

                            return (
                                <div key={req.id} className={`request-card ${isAvailable ? 'request-available' : ''}`}>
                                    <div className="request-top">
                                        <div className="request-icon">
                                            {isAvailable
                                                ? <PackageCheck size={24} color="#10b981" />
                                                : <AlertCircle size={24} color="#f97316" />
                                            }
                                        </div>
                                        <div className="request-info">
                                            <h3>{info?.product?.name || 'Artigo pedido'}</h3>
                                            <p className="request-detail">{detail}</p>
                                            <p className="request-date">
                                                <Calendar size={13} />
                                                Pedido em {new Date(req.created_at).toLocaleDateString('pt-PT')}
                                            </p>
                                        </div>
                                        <div className={`stock-status-badge ${isAvailable ? 'stock-ok' : 'stock-out'}`}>
                                            {isAvailable ? '✅ Disponível' : '⏳ Sem stock'}
                                        </div>
                                    </div>

                                    {isAvailable ? (
                                        <div className="request-actions">
                                            <p className="action-hint">
                                                <ArrowRight size={14} />
                                                O artigo está disponível! Clica para criar a tua encomenda.
                                            </p>
                                            <button
                                                className="btn-convert"
                                                onClick={() => convertToOrder(req)}
                                                disabled={isConverting}
                                            >
                                                {isConverting
                                                    ? <><Loader2 size={16} className="spin" /> A processar...</>
                                                    : <><ShoppingCart size={16} /> Criar Encomenda Agora</>
                                                }
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="request-waiting">
                                            <Clock size={14} />
                                            <span>Receberás uma notificação assim que este artigo chegar ao stock.</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            )}

            {/* Modal Detalhes */}
            {selectedOrder && (
                <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
                    <div className="modal-content order-details-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>Encomenda #{selectedOrder.id.slice(0, 8)}</h2>
                            <button onClick={() => setSelectedOrder(null)} className="close-btn"><XCircle size={22} /></button>
                        </div>
                        <div className="order-modal-body">
                            <div className="order-summary-header">
                                <div className="status-badge" style={{ background: getStatusStyle(selectedOrder.status).bg, color: getStatusStyle(selectedOrder.status).color }}>
                                    {getStatusStyle(selectedOrder.status).label}
                                </div>
                                <span className="order-date">{new Date(selectedOrder.created_at).toLocaleString('pt-PT')}</span>
                            </div>
                            <div className="order-items-scroll">
                                {selectedOrder.items?.map((item: any) => (
                                    <div key={item.id} className="detail-item">
                                        <div className="item-img">
                                            {item.store_products?.image_url ? <img src={item.store_products.image_url} alt="" /> : <ShoppingBag size={24} />}
                                        </div>
                                        <div className="item-info">
                                            <h4>{item.store_products?.name}</h4>
                                            <p>{item.store_product_variants?.size} / {item.store_product_variants?.color}</p>
                                            <div className="item-price-qty">
                                                <span>{item.quantity} × {item.unit_price.toFixed(2)}€</span>
                                                <span className="subtotal">{(item.quantity * item.unit_price).toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <div className="order-total-footer">
                                <div className="total-row">
                                    <span>Total</span>
                                    <span className="total-price">{selectedOrder.total_amount.toFixed(2)}€</span>
                                </div>
                                <p className="payment-note">
                                    <Clock size={14} />
                                    O pagamento deve ser efetuado na tua escola para que a encomenda seja processada.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .my-orders-page { padding-bottom: 2rem; }

                /* Tabs */
                .orders-tabs { display: flex; gap: 0.5rem; margin: 1.5rem 0; background: var(--bg-card); padding: 0.5rem; border-radius: 0.75rem; border: 1px solid var(--border); }
                .tab-btn { flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.65rem 1rem; border-radius: 0.5rem; border: none; cursor: pointer; font-weight: 600; font-size: 0.9rem; background: none; color: var(--text-muted); transition: all 0.2s; }
                .tab-btn.active { background: var(--primary); color: #000; }
                .tab-count { background: rgba(0,0,0,0.2); color: inherit; font-size: 0.72rem; font-weight: 800; padding: 2px 7px; border-radius: 99px; min-width: 20px; text-align: center; }
                .tab-count-alert { background: #ef4444 !important; color: white !important; animation: badge-pulse 2s infinite; }

                /* Loading */
                .loading-box { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; padding: 4rem; color: var(--text-muted); }
                .spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* Empty */
                .empty-orders { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border); text-align: center; gap: 1rem; color: var(--text-muted); }
                .empty-orders h2 { color: white; margin: 0; }
                .empty-orders p { margin: 0; }
                .empty-orders .btn-primary { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; }

                /* Encomendas Grid */
                .orders-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
                .order-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; cursor: pointer; transition: all 0.2s; }
                .order-card:hover { border-color: var(--primary); transform: translateY(-3px); }
                .order-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
                .order-id { display: flex; align-items: center; gap: 5px; color: var(--text-muted); font-size: 0.85rem; font-family: monospace; }
                .order-status-badge { display: flex; align-items: center; gap: 5px; padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; font-weight: 700; }
                .order-body { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; }
                .order-info { display: flex; align-items: center; gap: 8px; color: var(--text-muted); font-size: 0.9rem; }
                .order-info .amount { color: white; font-weight: 700; font-size: 1.05rem; }
                .order-footer { display: flex; justify-content: space-between; align-items: center; color: var(--primary); font-size: 0.85rem; font-weight: 600; padding-top: 1rem; border-top: 1px solid var(--border); }

                /* Pedidos Sem Stock */
                .requests-list { display: flex; flex-direction: column; gap: 1rem; }

                .available-banner { display: flex; align-items: flex-start; gap: 1rem; background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.3); border-radius: 0.75rem; padding: 1rem 1.25rem; color: #10b981; margin-bottom: 0.5rem; }
                .available-banner div { display: flex; flex-direction: column; gap: 0.25rem; }
                .available-banner strong { font-weight: 700; font-size: 1rem; color: #10b981; }
                .available-banner span { font-size: 0.875rem; color: var(--text-muted); }

                .request-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; transition: all 0.2s; }
                .request-card.request-available { border-color: rgba(16,185,129,0.4); box-shadow: 0 0 20px rgba(16,185,129,0.08); }
                .request-top { display: flex; align-items: flex-start; gap: 1rem; margin-bottom: 1.25rem; }
                .request-icon { flex-shrink: 0; width: 44px; height: 44px; border-radius: 50%; background: var(--bg-dark); display: flex; align-items: center; justify-content: center; }
                .request-info { flex: 1; }
                .request-info h3 { margin: 0 0 4px; color: white; font-size: 1rem; }
                .request-detail { margin: 0 0 6px; color: var(--text-muted); font-size: 0.875rem; }
                .request-date { display: flex; align-items: center; gap: 5px; margin: 0; color: var(--text-muted); font-size: 0.8rem; }

                .stock-status-badge { padding: 5px 12px; border-radius: 20px; font-size: 0.78rem; font-weight: 700; white-space: nowrap; flex-shrink: 0; }
                .stock-ok { background: rgba(16,185,129,0.1); color: #10b981; }
                .stock-out { background: rgba(249,115,22,0.1); color: #f97316; }

                .request-actions { display: flex; align-items: center; justify-content: space-between; gap: 1rem; padding-top: 1.25rem; border-top: 1px solid var(--border); flex-wrap: wrap; }
                .action-hint { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 0.85rem; color: #10b981; }
                .btn-convert { display: flex; align-items: center; gap: 0.5rem; padding: 0.65rem 1.25rem; background: linear-gradient(135deg, #10b981, #059669); color: #000; border: none; border-radius: 0.65rem; cursor: pointer; font-weight: 700; font-size: 0.9rem; transition: all 0.2s; white-space: nowrap; }
                .btn-convert:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(16,185,129,0.4); }
                .btn-convert:disabled { opacity: 0.7; cursor: not-allowed; }

                .request-waiting { display: flex; align-items: center; gap: 0.6rem; padding-top: 1rem; border-top: 1px solid var(--border); color: var(--text-muted); font-size: 0.85rem; }

                /* Modal */
                .order-details-modal { width: 95%; max-width: 500px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
                .order-modal-body { padding: 1.5rem; overflow-y: auto; }
                .order-summary-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
                .status-badge { padding: 5px 14px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; }
                .order-date { color: var(--text-muted); font-size: 0.82rem; }
                .order-items-scroll { display: flex; flex-direction: column; gap: 1rem; max-height: 40vh; overflow-y: auto; margin-bottom: 1.5rem; }
                .detail-item { display: flex; gap: 1rem; background: var(--bg-dark); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border); }
                .item-img { width: 50px; height: 50px; border-radius: 6px; background: var(--bg-card); display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
                .item-img img { width: 100%; height: 100%; object-fit: cover; }
                .item-info { flex: 1; }
                .item-info h4 { margin: 0 0 4px; font-size: 0.9rem; color: white; }
                .item-info p { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
                .item-price-qty { display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.82rem; color: var(--text-muted); }
                .subtotal { color: white; font-weight: 700; }
                .order-total-footer { border-top: 2px solid var(--border); padding-top: 1.25rem; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 1rem; }
                .total-row span:first-child { color: var(--text-muted); font-weight: 600; }
                .total-price { color: white; font-size: 1.4rem; font-weight: 800; }
                .payment-note { display: flex; align-items: flex-start; gap: 8px; background: rgba(59,130,246,0.08); color: #60a5fa; padding: 0.875rem; border-radius: 0.5rem; font-size: 0.82rem; line-height: 1.5; margin: 0; }
                .close-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; display: flex; }
                .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border); }
                .modal-header h2 { margin: 0; font-size: 1.1rem; color: white; }

                @media (max-width: 640px) {
                    .tab-btn { font-size: 0.8rem; padding: 0.6rem 0.5rem; }
                    .request-top { flex-wrap: wrap; }
                    .stock-status-badge { order: -1; }
                    .request-actions { flex-direction: column; align-items: flex-start; }
                    .btn-convert { width: 100%; justify-content: center; }
                }
            `}</style>
        </div>
    );
}
