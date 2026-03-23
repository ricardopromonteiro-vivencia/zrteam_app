import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { ShoppingCart, ShoppingBag, Eye, Search, X, Plus, Minus, Check, AlertCircle, ClipboardList } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';

interface CartItem {
    variant_id: string;
    product_id: string;
    name: string;
    size: string;
    color: string;
    price: number;
    quantity: number;
    image_url: string;
    max_stock: number;
}

export default function Store() {
    const { profile } = useOutletContext<any>() || {};
    const [products, setProducts] = useState<any[]>([]);
    const [categories, setCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('all');
    const [selectedProduct, setSelectedProduct] = useState<any>(null);
    const [selectedVariant, setSelectedVariant] = useState<any>(null);
    const [currentViewImage, setCurrentViewImage] = useState<string | null>(null);
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [orderPlacing, setOrderPlacing] = useState(false);
    const [requestPlacing, setRequestPlacing] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: cats } = await supabase.from('store_categories').select('*').order('name');
        const { data: prods } = await supabase
            .from('store_products')
            .select(`
                *,
                store_categories(name),
                store_product_variants(stock_quantity)
            `)
            .eq('is_available', true);
        
        if (cats) setCategories(cats);
        if (prods) setProducts(prods);
        
        // Load cart from localStorage once when data is fetched or initial mount
        const savedCart = localStorage.getItem('zr_store_cart');
        if (savedCart) setCart(JSON.parse(savedCart));
        
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    useEffect(() => {
        localStorage.setItem('zr_store_cart', JSON.stringify(cart));
    }, [cart]);

    const handleViewDetails = async (product: any) => {
        setLoading(true);
        const { data: variants } = await supabase
            .from('store_product_variants')
            .select('*')
            .eq('product_id', product.id);
        
        setSelectedProduct({ ...product, variants });
        setSelectedVariant(null);
        setCurrentViewImage(product.image_url || null);
        setLoading(false);
        window.scrollTo({ top: 0, behavior: 'smooth' }); // Garante que o utilizador vê o modal se a página for longa
    };

    const addToCart = () => {
        if (!selectedVariant) return;

        const existingIndex = cart.findIndex(item => item.variant_id === selectedVariant.id);
        if (existingIndex > -1) {
            const newCart = [...cart];
            if (newCart[existingIndex].quantity < selectedVariant.stock_quantity) {
                newCart[existingIndex].quantity += 1;
                setCart(newCart);
            } else {
                alert('Stock máximo atingido para esta opção.');
            }
        } else {
            setCart([...cart, {
                variant_id: selectedVariant.id,
                product_id: selectedProduct.id,
                name: selectedProduct.name,
                size: selectedVariant.size,
                color: selectedVariant.color,
                price: selectedProduct.price,
                quantity: 1,
                image_url: selectedProduct.image_url,
                max_stock: selectedVariant.stock_quantity
            }]);
        }
        setSelectedProduct(null);
    };

    const submitSpecialRequest = async () => {
        if (!profile || !selectedProduct || !selectedVariant) return;
        setRequestPlacing(true);

        const { data: order } = await supabase
            .from('store_orders')
            .insert({
                user_id: profile.id,
                school_id: profile.school_id,
                total_amount: selectedProduct.price,
                status: 'pendente',
                notes: `encomenda_especial | ${selectedVariant.size || ''}${selectedVariant.color ? ' - ' + selectedVariant.color : ''}`
            })
            .select()
            .single();

        if (order) {
            await supabase.from('store_order_items').insert({
                order_id: order.id,
                product_id: selectedProduct.id,
                variant_id: selectedVariant.id,
                quantity: 1,
                unit_price: selectedProduct.price
            });
            alert('Pedido efetuado com sucesso! Entraremos em contacto assim que o artigo estiver disponível.');
            setSelectedProduct(null);
        }
        setRequestPlacing(false);
    };

    const updateCartQty = (variantId: string, delta: number) => {
        const newCart = cart.map(item => {
            if (item.variant_id === variantId) {
                const newQty = Math.max(0, item.quantity + delta);
                if (newQty > item.max_stock) return item;
                return { ...item, quantity: newQty };
            }
            return item;
        }).filter(item => item.quantity > 0);
        setCart(newCart);
    };

    const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const submitOrder = async () => {
        if (!profile || cart.length === 0) return;
        setOrderPlacing(true);

        const { data: order } = await supabase
            .from('store_orders')
            .insert({
                user_id: profile.id,
                school_id: profile.school_id,
                total_amount: cartTotal,
                status: 'pendente'
            })
            .select()
            .single();

        if (order) {
            const orderItems = cart.map(item => ({
                order_id: order.id,
                product_id: item.product_id,
                variant_id: item.variant_id,
                quantity: item.quantity,
                unit_price: item.price
            }));

            const { error: itemsError } = await supabase.from('store_order_items').insert(orderItems);
            
            if (!itemsError) {
                alert('Encomenda submetida com sucesso!');
                setCart([]);
                setIsCartOpen(false);
            }
        }
        setOrderPlacing(false);
    };

    const filteredProducts = products.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesCategory = selectedCategory === 'all' || p.category_id === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className="store-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Loja ZR Team</h1>
                    <p className="page-subtitle">Equipa-te com o melhor material de Jiu-Jitsu.</p>
                </div>
                <button className="cart-trigger" onClick={() => setIsCartOpen(true)}>
                    <ShoppingCart size={24} />
                    {cart.length > 0 && <span className="cart-badge">{cart.length}</span>}
                </button>
            </header>

            <div className="store-controls">
                <div className="search-bar">
                    <Search size={20} />
                    <input placeholder="O que procuras?" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
                <div className="category-tabs">
                    <button className={selectedCategory === 'all' ? 'active' : ''} onClick={() => setSelectedCategory('all')}>Todos</button>
                    {categories.map(cat => (
                        <button key={cat.id} className={selectedCategory === cat.id ? 'active' : ''} onClick={() => setSelectedCategory(cat.id)}>{cat.name}</button>
                    ))}
                </div>
            </div>

            <div className="product-grid">
                {loading ? (
                    <div className="loading-container">A carregar produtos...</div>
                ) : filteredProducts.length === 0 ? (
                    <div className="loading-container">Nenhum produto encontrado.</div>
                ) : (
                    filteredProducts.map(product => {
                    const totalStock = product.store_product_variants?.reduce((sum: number, v: any) => sum + (v.stock_quantity || 0), 0) || 0;
                    const isOutOfStock = totalStock <= 0;

                    return (
                        <div key={product.id} className={`product-card ${isOutOfStock ? 'card-out-of-stock' : ''}`} onClick={() => handleViewDetails(product)}>
                            <div className="product-image">
                                {product.image_url ? <img src={product.image_url} alt={product.name} /> : <ShoppingBag size={48} />}
                                {isOutOfStock && <div className="out-of-stock-badge">Não disponível</div>}
                            </div>
                            <div className="product-info">
                                <span className="product-category">{product.store_categories?.name}</span>
                                <h3>{product.name}</h3>
                                <div className="product-footer">
                                    <span className="product-price">{product.price.toFixed(2)}€</span>
                                    <button className="view-btn"><Eye size={18} /></button>
                                </div>
                            </div>
                        </div>
                    );
                    })
                )}
            </div>

            {/* Modal Detalhes Produto */}
            {selectedProduct && (
                <div className="modal-overlay">
                    <div className="modal-content product-details-modal">
                        <div className="details-layout">
                            <button className="close-modal" onClick={() => setSelectedProduct(null)}><X /></button>
                            <div className="details-image-container">
                                <div className="details-image main-view">
                                    {currentViewImage ? (
                                        <img src={currentViewImage} alt={selectedProduct.name} />
                                    ) : (
                                        <ShoppingBag size={80} />
                                    )}
                                </div>
                                {selectedProduct.gallery_urls && selectedProduct.gallery_urls.length > 0 && (
                                    <div className="details-gallery-strip">
                                        {selectedProduct.image_url && (
                                            <div 
                                                className={`gallery-thumb ${currentViewImage === selectedProduct.image_url ? 'active' : ''}`}
                                                onClick={() => setCurrentViewImage(selectedProduct.image_url)}
                                            >
                                                <img src={selectedProduct.image_url} alt="Capa" />
                                            </div>
                                        )}
                                        {selectedProduct.gallery_urls.map((url: string, index: number) => (
                                            <div 
                                                key={index} 
                                                className={`gallery-thumb ${currentViewImage === url ? 'active' : ''}`}
                                                onClick={() => setCurrentViewImage(url)}
                                            >
                                                <img src={url} alt={`Galeria ${index}`} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                            <div className="details-info">
                                <span className="details-category">{selectedProduct.store_categories?.name}</span>
                                <h2>{selectedProduct.name}</h2>
                                <p className="details-price">{selectedProduct.price.toFixed(2)}€</p>
                                <p className="details-description">{selectedProduct.description}</p>

                                <div className="variant-picker">
                                    <h3>Selecionar Opção:</h3>
                                    <div className="variant-options">
                                        {selectedProduct.variants?.map((v: any) => (
                                            <button 
                                                key={v.id} 
                                                className={`variant-chip ${selectedVariant?.id === v.id ? 'selected' : ''} ${v.stock_quantity <= 0 ? 'out-of-stock' : ''}`}
                                                onClick={() => setSelectedVariant(v)}
                                            >
                                                {v.size && v.size} {v.color && `- ${v.color}`}
                                                {v.stock_quantity <= 0 && " (Esgotado)"}
                                            </button>
                                        ))}
                                    </div>
                                    {selectedVariant && (
                                        <p className="stock-info">
                                            {selectedVariant.stock_quantity > 0 
                                                ? <><Check size={14} color="var(--primary)" /> Em stock ({selectedVariant.stock_quantity} un.)</>
                                                : <><AlertCircle size={14} color="#ef4444" /> Não disponível</>
                                            }
                                        </p>
                                    )}
                                </div>

                                {selectedVariant && selectedVariant.stock_quantity > 0 && (
                                    <button className="add-to-cart-btn btn-primary" onClick={addToCart}>
                                        <Plus size={20} /> Adicionar ao Carrinho
                                    </button>
                                )}
                                {selectedVariant && selectedVariant.stock_quantity <= 0 && (
                                    <button className="add-to-cart-btn btn-request" onClick={submitSpecialRequest} disabled={requestPlacing}>
                                        <ClipboardList size={20} /> {requestPlacing ? 'A enviar pedido...' : 'Efetuar Pedido'}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Sidebar Carrinho */}
            {isCartOpen && (
                <div className="modal-overlay cart-overlay" onClick={() => setIsCartOpen(false)}>
                    <div className="cart-sidebar" onClick={e => e.stopPropagation()}>
                        <div className="cart-header">
                            <h2>O teu Carrinho</h2>
                            <button onClick={() => setIsCartOpen(false)}><X /></button>
                        </div>
                        
                        <div className="cart-items">
                            {cart.length === 0 ? (
                                <div className="empty-cart">
                                    <ShoppingBag size={64} />
                                    <p>O teu carrinho está vazio.</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.variant_id} className="cart-item">
                                        <div className="cart-item-img">
                                            {item.image_url ? <img src={item.image_url} alt="" /> : <ShoppingBag />}
                                        </div>
                                        <div className="cart-item-info">
                                            <h4>{item.name}</h4>
                                            <span>{item.size} / {item.color}</span>
                                            <div className="cart-item-controls">
                                                <div className="qty-btns">
                                                    <button onClick={() => updateCartQty(item.variant_id, -1)}><Minus size={14} /></button>
                                                    <span>{item.quantity}</span>
                                                    <button onClick={() => updateCartQty(item.variant_id, 1)} disabled={item.quantity >= item.max_stock}><Plus size={14} /></button>
                                                </div>
                                                <span className="item-price">{(item.price * item.quantity).toFixed(2)}€</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {cart.length > 0 && (
                            <div className="cart-footer">
                                <div className="cart-total">
                                    <span>Total:</span>
                                    <span>{cartTotal.toFixed(2)}€</span>
                                </div>
                                <button className="checkout-btn btn-primary" onClick={submitOrder} disabled={orderPlacing}>
                                    {orderPlacing ? 'A processar...' : 'Finalizar Encomenda'}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <style>{`
                .cart-trigger { position: relative; background: var(--bg-card); border: 1px solid var(--border); padding: 0.75rem; border-radius: 50%; color: white; cursor: pointer; }
                .cart-badge { position: absolute; top: -5px; right: -5px; background: var(--primary); color: #000; font-size: 0.75rem; font-weight: 700; width: 20px; height: 20px; border-radius: 50%; display: flex; alignItems: center; justifyContent: center; }
                
                .loading-container { grid-column: 1 / -1; padding: 4rem; text-align: center; color: var(--text-muted); background: var(--bg-card); border-radius: 1rem; border: 1px solid var(--border); }

                .store-controls { margin-top: 2rem; display: flex; flex-direction: column; gap: 1.5rem; }
                .search-bar { background: var(--bg-card); border: 1px solid var(--border); padding: 0.75rem 1rem; border-radius: 0.75rem; display: flex; alignItems: center; gap: 0.75rem; }
                .search-bar input { background: none; border: none; color: white; width: 100%; outline: none; }
                .category-tabs { display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; }
                .category-tabs button { padding: 0.5rem 1.25rem; border-radius: 20px; border: 1px solid var(--border); background: var(--bg-card); color: var(--text-muted); cursor: pointer; white-space: nowrap; transition: all 0.2s; }
                .category-tabs button.active { background: var(--primary); color: #000; border-color: var(--primary); font-weight: 600; }

                .product-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
                .product-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; cursor: pointer; transition: all 0.2s; }
                .product-card:hover { border-color: var(--primary); transform: translateY(-4px); }
                .product-image { height: 200px; background: #1a1a1a; display: flex; alignItems: center; justifyContent: center; overflow: hidden; }
                .product-image img { width: 100%; height: 100%; object-fit: cover; }
                .product-info { padding: 1.25rem; }
                .product-category { font-size: 0.7rem; text-transform: uppercase; color: var(--primary); font-weight: 700; letter-spacing: 0.5px; }
                .product-info h3 { margin: 0.5rem 0; font-size: 1.1rem; color: white; }
                .product-footer { display: flex; justifyContent: space-between; alignItems: center; margin-top: 1rem; }
                .product-price { font-size: 1.25rem; font-weight: 700; color: white; }
                .view-btn { background: rgba(255,255,255,0.05); color: white; border: 1px solid var(--border); padding: 8px; border-radius: 8px; }

                .card-out-of-stock { opacity: 0.8; }
                .out-of-stock-badge { position: absolute; top: 1rem; right: 1rem; background: #ef4444; color: white; padding: 4px 12px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

                .product-details-modal { width: 95%; max-width: 900px; padding: 0; overflow: hidden; border-radius: 1.5rem; position: relative; }
                .close-modal { position: absolute; top: 1rem; right: 1rem; background: rgba(0,0,0,0.6); border: none; color: white; padding: 8px; border-radius: 50%; cursor: pointer; z-index: 50; font-size: 1.25rem; display: flex; transition: all 0.2s; }
                .close-modal:hover { background: rgba(239,68,68,0.8); transform: scale(1.1); }
                .details-layout { display: flex; flex-direction: row; height: 100%; overflow: hidden; border-radius: 1.5rem; }
                .details-image-container { flex: 1; display: flex; flex-direction: column; background: #1a1a1a; overflow: hidden; position: relative; border-radius: 1.5rem 0 0 1.5rem; }
                .details-image.main-view { flex: 1; display: flex; alignItems: center; justifyContent: center; overflow: hidden; padding: 1rem; }
                .details-image.main-view img { width: 100%; height: 100%; object-fit: contain; }
                
                .details-gallery-strip { display: flex; gap: 0.5rem; padding: 1rem; overflow-x: auto; background: #0f0f0f; border-top: 1px solid var(--border); }
                .gallery-thumb { width: 60px; height: 60px; flex-shrink: 0; border-radius: 6px; overflow: hidden; cursor: pointer; border: 2px solid transparent; opacity: 0.5; transition: all 0.2s; background: #1a1a1a; }
                .gallery-thumb:hover { opacity: 0.8; }
                .gallery-thumb.active { border-color: var(--primary); opacity: 1; }
                .gallery-thumb img { width: 100%; height: 100%; object-fit: cover; }
                
                .details-info { flex: 1; padding: 2rem; display: flex; flex-direction: column; gap: 1rem; overflow-y: auto; }
                .details-category { color: var(--primary); font-weight: 700; font-size: 0.8rem; text-transform: uppercase; }
                .details-info h2 { font-size: 1.75rem; color: white; margin: 0; }
                .details-price { font-size: 1.75rem; font-weight: 700; color: white; }
                .details-description { color: var(--text-muted); line-height: 1.6; margin: 1rem 0; }
                
                .variant-picker h3 { font-size: 0.9rem; color: white; margin-bottom: 1rem; }
                .variant-options { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                .variant-chip { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-card); color: white; cursor: pointer; transition: all 0.2s; }
                .variant-chip.selected { border-color: var(--primary); background: rgba(16,185,129,0.1); color: var(--primary); }
                .variant-chip.selected.out-of-stock { border-color: #f97316; background: rgba(249,115,22,0.1); color: #f97316; }
                .variant-chip.out-of-stock { opacity: 0.6; cursor: pointer; color: #f97316; border-color: rgba(249,115,22,0.3); }
                .stock-info { display: flex; alignItems: center; gap: 6px; font-size: 0.85rem; margin-top: 1rem; }

                .add-to-cart-btn { margin-top: 2rem; width: 100%; display: flex; alignItems: center; justifyContent: center; gap: 0.75rem; padding: 1rem; font-size: 1.1rem; }
                .btn-request { background: linear-gradient(135deg, #f97316, #ea580c); color: white; border: none; border-radius: 0.75rem; cursor: pointer; font-weight: 700; transition: all 0.2s; }
                .btn-request:hover { background: linear-gradient(135deg, #ea580c, #c2410c); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(249,115,22,0.4); }
                .btn-request:disabled { opacity: 0.7; cursor: not-allowed; transform: none; }

                .cart-overlay { justifyContent: flex-end; alignItems: stretch; }
                .cart-sidebar { width: 400px; height: 100%; background: var(--bg-card); border-left: 1px solid var(--border); display: flex; flex-direction: column; animation: slideInRight 0.3s ease; }
                .cart-header { padding: 1.5rem; border-bottom: 1px solid var(--border); display: flex; justifyContent: space-between; alignItems: center; }
                .cart-header h2 { margin: 0; font-size: 1.25rem; }
                .cart-header button { background: none; border: none; color: white; cursor: pointer; }
                
                .cart-items { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem; }
                .empty-cart { flex: 1; display: flex; flex-direction: column; alignItems: center; justifyContent: center; color: var(--text-muted); gap: 1rem; opacity: 0.5; }
                .cart-item { display: flex; gap: 1rem; }
                .cart-item-img { width: 64px; height: 64px; border-radius: 8px; background: #1a1a1a; display: flex; alignItems: center; justifyContent: center; overflow: hidden; }
                .cart-item-img img { width: 100%; height: 100%; object-fit: cover; }
                .cart-item-info { flex: 1; }
                .cart-item-info h4 { margin: 0 0 4px 0; color: white; }
                .cart-item-info span { font-size: 0.8rem; color: var(--text-muted); }
                .cart-item-controls { display: flex; justifyContent: space-between; alignItems: center; margin-top: 0.75rem; }
                .qty-btns { display: flex; alignItems: center; gap: 1rem; background: var(--bg-dark); padding: 4px 8px; border-radius: 6px; }
                .qty-btns button { background: none; border: none; color: white; cursor: pointer; padding: 4px; }
                .item-price { font-weight: 700; color: white; }

                .cart-footer { padding: 1.5rem; border-top: 1px solid var(--border); background: var(--bg-dark); }
                .cart-total { display: flex; justifyContent: space-between; font-size: 1.25rem; font-weight: 700; margin-bottom: 1.5rem; color: white; }
                .checkout-btn { width: 100%; padding: 1rem; }

                @keyframes slideInRight {
                    from { transform: translateX(100%); }
                    to { transform: translateX(0); }
                }

                @media (max-width: 768px) {
                    .details-layout { flex-direction: column; height: 100%; overflow: hidden; }
                    .details-image-container { flex: 0 0 45%; min-height: 250px; border-radius: 1.5rem 1.5rem 0 0; }
                    .details-image.main-view { padding: 0.5rem; }
                    .details-gallery-strip { padding: 0.5rem; }
                    .gallery-thumb { width: 50px; height: 50px; }
                    .details-info { flex: 1; padding: 1.5rem; overflow-y: auto; padding-bottom: 2rem; }
                    .details-info h2 { font-size: 1.5rem; }
                    .cart-sidebar { width: 100%; }
                }
            `}</style>
        </div>
    );
}

