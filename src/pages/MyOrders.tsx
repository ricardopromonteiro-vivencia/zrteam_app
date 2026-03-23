import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Clock, CheckCircle, XCircle, ShoppingBag, ChevronRight, Hash, Calendar, CreditCard } from 'lucide-react';
import { useOutletContext, useNavigate } from 'react-router-dom';

interface Order {
    id: string;
    created_at: string;
    status: 'pendente' | 'pago' | 'cancelado' | 'entregue';
    total_amount: number;
    items?: any[];
}

export default function MyOrders() {
    const { profile } = useOutletContext<any>() || {};
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any>(null);
    const navigate = useNavigate();

    const fetchMyOrders = useCallback(async () => {
        if (!profile?.id) return;
        setLoading(true);
        const { data } = await supabase
            .from('store_orders')
            .select('*')
            .eq('user_id', profile.id)
            .order('created_at', { ascending: false });
        
        if (data) setOrders(data);
        setLoading(false);
    }, [profile?.id]);

    useEffect(() => {
        fetchMyOrders();
    }, [fetchMyOrders]);

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
        switch(status) {
            case 'pendente': return { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', icon: Clock, label: 'Pendente' };
            case 'pago': return { bg: 'rgba(16,185,129,0.1)', color: '#10b981', icon: CheckCircle, label: 'Pago' };
            case 'entregue': return { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', icon: ShoppingBag, label: 'Entregue' };
            case 'cancelado': return { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', icon: XCircle, label: 'Cancelado' };
            default: return { bg: 'gray', color: 'white', icon: Clock, label: status };
        }
    };

    if (orders.length === 0 && !loading) {
        return (
            <div className="my-orders-page animate-fade-in">
                <header className="page-header">
                    <h1 className="page-title">As Minhas Encomendas</h1>
                </header>
                <div className="empty-orders">
                    <ShoppingBag size={64} />
                    <h2>Ainda não tens encomendas</h2>
                    <p>Visita a nossa loja para veres os artigos disponíveis.</p>
                    <button className="btn-primary" onClick={() => navigate('/loja')}>Ir para a Loja</button>
                </div>
                <style>{`
                    .empty-orders { display: flex; flex-direction: column; alignItems: center; justifyContent: center; padding: 4rem 2rem; background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border); margin-top: 2rem; text-align: center; gap: 1rem; }
                    .empty-orders h2 { color: white; margin: 0; }
                    .empty-orders p { color: var(--text-muted); margin-bottom: 1rem; }
                `}</style>
            </div>
        );
    }

    return (
        <div className="my-orders-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">As Minhas Encomendas</h1>
                    <p className="page-subtitle">Acompanha o estado dos teus pedidos.</p>
                </div>
            </header>

            <div className="orders-grid">
                {orders.map(order => {
                    const style = getStatusStyle(order.status);
                    const StatusIcon = style.icon;
                    return (
                        <div key={order.id} className="order-card" onClick={() => viewOrderDetails(order)}>
                            <div className="order-header">
                                <div className="order-id">
                                    <Hash size={16} />
                                    <span>#{order.id.slice(0, 8)}</span>
                                </div>
                                <div className="order-status" style={{ backgroundColor: style.bg, color: style.color }}>
                                    <StatusIcon size={14} />
                                    {style.label}
                                </div>
                            </div>
                            <div className="order-body">
                                <div className="order-info">
                                    <Calendar size={16} />
                                    <span>{new Date(order.created_at).toLocaleDateString()}</span>
                                </div>
                                <div className="order-info">
                                    <CreditCard size={16} />
                                    <span className="amount">{order.total_amount.toFixed(2)}€</span>
                                </div>
                            </div>
                            <div className="order-footer">
                                <span>Ver Detalhes</span>
                                <ChevronRight size={16} />
                            </div>
                        </div>
                    );
                })}
            </div>

            {selectedOrder && (
                <div className="modal-overlay">
                    <div className="modal-content order-details-modal">
                        <div className="modal-header">
                            <h2>Detalhes da Encomenda #{selectedOrder.id.slice(0, 8)}</h2>
                            <button onClick={() => setSelectedOrder(null)} className="close-btn"><XCircle /></button>
                        </div>
                        
                        <div className="order-modal-body">
                            <div className="order-summary-header">
                                <div className="status-badge" style={{ backgroundColor: getStatusStyle(selectedOrder.status).bg, color: getStatusStyle(selectedOrder.status).color }}>
                                    {getStatusStyle(selectedOrder.status).label}
                                </div>
                                <span className="order-date">{new Date(selectedOrder.created_at).toLocaleString()}</span>
                            </div>

                            <div className="order-items-scroll">
                                {selectedOrder.items?.map((item: any) => (
                                    <div key={item.id} className="detail-item">
                                        <div className="item-img">
                                            {item.store_products?.image_url ? <img src={item.store_products.image_url} alt="" /> : <ShoppingBag />}
                                        </div>
                                        <div className="item-info">
                                            <h4>{item.store_products?.name}</h4>
                                            <p>{item.store_product_variants?.size} / {item.store_product_variants?.color}</p>
                                            <div className="item-price-qty">
                                                <span>{item.quantity} x {item.unit_price.toFixed(2)}€</span>
                                                <span className="subtotal">{(item.quantity * item.unit_price).toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="order-total-footer">
                                <div className="total-row">
                                    <span>Total Encomenda</span>
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
                .orders-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
                .order-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; padding: 1.5rem; cursor: pointer; transition: all 0.2s; }
                .order-card:hover { border-color: var(--primary); transform: translateY(-4px); }
                
                .order-header { display: flex; justifyContent: space-between; alignItems: center; margin-bottom: 1.5rem; }
                .order-id { display: flex; alignItems: center; gap: 6px; color: var(--text-muted); font-size: 0.9rem; font-family: monospace; }
                .order-status { display: flex; alignItems: center; gap: 6px; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }
                
                .order-body { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem; }
                .order-info { display: flex; alignItems: center; gap: 10px; color: var(--text-muted); font-size: 0.95rem; }
                .order-info .amount { color: white; font-weight: 700; font-size: 1.1rem; }
                
                .order-footer { display: flex; justifyContent: space-between; alignItems: center; color: var(--primary); font-size: 0.9rem; font-weight: 600; padding-top: 1rem; border-top: 1px solid var(--border); }

                .order-details-modal { width: 95%; max-width: 500px; padding: 0; overflow: hidden; display: flex; flex-direction: column; }
                .order-modal-body { padding: 1.5rem; overflow-y: auto; flex: 1; min-height: 0; }
                .order-summary-header { display: flex; justifyContent: space-between; alignItems: center; margin-bottom: 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
                .status-badge { padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 0.85rem; }
                .order-date { color: var(--text-muted); font-size: 0.85rem; }

                .order-items-scroll { display: flex; flex-direction: column; gap: 1rem; max-height: 40vh; overflow-y: auto; margin-bottom: 2rem; }
                .detail-item { display: flex; gap: 1rem; background: var(--bg-dark); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border); }
                .item-img { width: 50px; height: 50px; border-radius: 6px; background: var(--bg-card); overflow: hidden; display: flex; alignItems: center; justifyContent: center; }
                .item-img img { width: 100%; height: 100%; object-fit: cover; }
                .item-info { flex: 1; }
                .item-info h4 { margin: 0 0 4px 0; font-size: 0.95rem; color: white; }
                .item-info p { margin: 0; font-size: 0.8rem; color: var(--text-muted); }
                .item-price-qty { display: flex; justifyContent: space-between; margin-top: 8px; font-size: 0.85rem; }
                .subtotal { color: white; font-weight: 700; }

                .order-total-footer { border-top: 2px solid var(--border); padding-top: 1.5rem; }
                .total-row { display: flex; justifyContent: space-between; margin-bottom: 1rem; }
                .total-row span:first-child { color: var(--text-muted); font-weight: 600; }
                .total-price { color: white; font-size: 1.5rem; font-weight: 800; }
                .payment-note { background: rgba(59,130,246,0.1); color: #3b82f6; padding: 1rem; border-radius: 0.5rem; font-size: 0.85rem; display: flex; gap: 10px; line-height: 1.4; }
            `}</style>
        </div>
    );
}
