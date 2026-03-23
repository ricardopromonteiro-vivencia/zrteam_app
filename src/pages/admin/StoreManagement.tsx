import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { Package, Plus, Edit2, Trash2, Camera, Save, X, Tag } from 'lucide-react';

interface Category {
    id: string;
    name: string;
}

interface Variant {
    id?: string;
    size: string;
    color: string;
    stock_quantity: number;
}

export default function StoreManagement() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [editingProduct, setEditingProduct] = useState<any>(null);
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [variants, setVariants] = useState<Variant[]>([]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: cats } = await supabase.from('store_categories').select('*').order('name');
        const { data: prods } = await supabase.from('store_products').select('*, store_categories(name)').order('created_at', { ascending: false });
        if (cats) setCategories(cats);
        if (prods) setProducts(prods);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    async function handleSaveCategory(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        const { error } = editingCategory.id 
            ? await supabase.from('store_categories').update({ name: editingCategory.name }).eq('id', editingCategory.id)
            : await supabase.from('store_categories').insert({ name: editingCategory.name });
        
        if (!error) {
            setEditingCategory(null);
            setShowCategoryModal(false);
            fetchData();
        }
        setLoading(false);
    }

    async function handleSaveProduct(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        
        const productData = {
            name: editingProduct.name,
            description: editingProduct.description,
            price: parseFloat(editingProduct.price),
            category_id: editingProduct.category_id || null,
            image_url: editingProduct.image_url,
            is_available: editingProduct.is_available ?? true,
            gallery_urls: editingProduct.gallery_urls || []
        };

        const { data, error } = editingProduct.id
            ? await supabase.from('store_products').update(productData).eq('id', editingProduct.id).select().single()
            : await supabase.from('store_products').insert(productData).select().single();

        if (!error && data) {
            const productId = data.id;
            if (editingProduct.id) {
                await supabase.from('store_product_variants').delete().eq('product_id', productId);
            }
            if (variants.length > 0) {
                const variantsToInsert = variants.map(v => ({
                    product_id: productId,
                    size: v.size,
                    color: v.color,
                    stock_quantity: v.stock_quantity
                }));
                await supabase.from('store_product_variants').insert(variantsToInsert);
            }
            
            setEditingProduct(null);
            setVariants([]);
            fetchData();
        }
        setLoading(false);
    }

    async function handleDeleteProduct(product: any) {
        if (!confirm('Eliminar este produto?')) return;
        // Se o produto tiver imagem principal ou galeria, tentar apagá-las do storage
        const urlsToDelete = [];
        if (product.image_url) urlsToDelete.push(product.image_url);
        if (product.gallery_urls && product.gallery_urls.length > 0) {
            urlsToDelete.push(...product.gallery_urls);
        }

        if (urlsToDelete.length > 0) {
            try {
                const fileNames = urlsToDelete.map(url => {
                    const parts = url.split('/');
                    return parts[parts.length - 1];
                }).filter(Boolean);
                
                if (fileNames.length > 0) {
                    await supabase.storage.from('store_products').remove(fileNames);
                }
            } catch (err) {
                console.error("Erro ao apagar imagens do storage:", err);
            }
        }

        const { error } = await supabase.from('store_products').delete().eq('id', product.id);
        if (!error) fetchData();
    }

    const resizeImage = (file: File): Promise<Blob> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    const max_size = 800;

                    if (width > height) {
                        if (width > max_size) {
                            height *= max_size / width;
                            width = max_size;
                        }
                    } else {
                        if (height > max_size) {
                            width *= max_size / height;
                            height = max_size;
                        }
                    }

                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    canvas.toBlob((blob) => {
                        if (blob) resolve(blob);
                    }, 'image/jpeg', 0.8);
                };
                img.src = e.target?.result as string;
            };
            reader.readAsDataURL(file);
        });
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const resizedBlob = await resizeImage(file);
            const fileName = `${Math.random()}.jpg`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('store_products')
                .upload(filePath, resizedBlob);

            if (!uploadError) {
                const { data: { publicUrl } } = supabase.storage
                    .from('store_products')
                    .getPublicUrl(filePath);
                setEditingProduct({ ...editingProduct, image_url: publicUrl });
            }
        } catch (err) {
            console.error("Erro no upload:", err);
        }
        setLoading(false);
    };

    const handleRemoveImage = async () => {
        if (!editingProduct.image_url) return;
        
        if (!confirm('Tens a certeza que queres remover a imagem? Esta ação não pode ser desfeita.')) return;
        setLoading(true);

        try {
            const urlParts = editingProduct.image_url.split('/');
            const fileName = urlParts[urlParts.length - 1];
            
            if (fileName) {
                await supabase.storage.from('store_products').remove([fileName]);
            }
            // Atualizar o estado local
            setEditingProduct({ ...editingProduct, image_url: null });
            
            // Se o produto já existir na BD, remover a referência também
            if (editingProduct.id) {
                await supabase.from('store_products').update({ image_url: null }).eq('id', editingProduct.id);
            }
        } catch (err) {
             console.error("Erro ao remover imagem:", err);
        }
        setLoading(false);
    };

    const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files || files.length === 0) return;

        setLoading(true);
        const newUrls: string[] = [];

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const resizedBlob = await resizeImage(file);
                const fileName = `${Math.random()}.jpg`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('store_products')
                    .upload(filePath, resizedBlob);

                if (!uploadError) {
                    const { data: { publicUrl } } = supabase.storage
                        .from('store_products')
                        .getPublicUrl(filePath);
                    newUrls.push(publicUrl);
                }
            }
            
            const currentGallery = editingProduct.gallery_urls || [];
            setEditingProduct({ ...editingProduct, gallery_urls: [...currentGallery, ...newUrls] });

        } catch (err) {
            console.error("Erro no upload da galeria:", err);
        }
        setLoading(false);
    };

    const handleRemoveFromGallery = async (urlToRemove: string) => {
        if (!confirm('Remover esta imagem da galeria?')) return;
        setLoading(true);
        try {
             const urlParts = urlToRemove.split('/');
             const fileName = urlParts[urlParts.length - 1];
             if (fileName) {
                 await supabase.storage.from('store_products').remove([fileName]);
             }
             const newGallery = (editingProduct.gallery_urls || []).filter((u: string) => u !== urlToRemove);
             setEditingProduct({ ...editingProduct, gallery_urls: newGallery });
             if (editingProduct.id) {
                 await supabase.from('store_products').update({ gallery_urls: newGallery }).eq('id', editingProduct.id);
             }
        } catch (err) {
             console.error("Erro ao remover imagem da galeria:", err);
        }
        setLoading(false);
    };

    const handleMakeCover = async (url: string) => {
        const currentCover = editingProduct.image_url;
        const newGallery = (editingProduct.gallery_urls || []).filter((u: string) => u !== url);
        if (currentCover) {
            newGallery.push(currentCover);
        }
        
        setEditingProduct({
            ...editingProduct,
            image_url: url,
            gallery_urls: newGallery
        });
    };

    const addVariant = () => {
        setVariants([...variants, { size: '', color: '', stock_quantity: 0 }]);
    };

    const removeVariant = (index: number) => {
        setVariants(variants.filter((_, i) => i !== index));
    };

    const updateVariant = (index: number, field: keyof Variant, value: any) => {
        const newVariants = [...variants];
        newVariants[index] = { ...newVariants[index], [field]: value };
        setVariants(newVariants);
    };

    const loadProductForEdit = async (product: any) => {
        setEditingProduct({
            ...product,
            gallery_urls: product.gallery_urls || []
        });
        const { data: vars } = await supabase.from('store_product_variants').select('*').eq('product_id', product.id);
        if (vars) setVariants(vars);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div className="store-management-page animate-fade-in">
            <header className="page-header">
                <div>
                    <h1 className="page-title">Gestão da Loja</h1>
                    <p className="page-subtitle">Gere os artigos, stock e categorias da loja CTS/ZR.</p>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button className="btn-secondary" onClick={() => { setEditingCategory({}); setShowCategoryModal(true); }}>
                        <Tag size={20} /> Categorias
                    </button>
                    <button className="btn-primary" onClick={() => { setEditingProduct({ name: '', price: 0, category_id: categories[0]?.id || '', gallery_urls: [] }); setVariants([]); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                        <Plus size={20} /> Novo Artigo
                    </button>
                </div>
            </header>

            <div className="admin-grid">
                {products.map(product => (
                    <div key={product.id} className="admin-card">
                        <div className="product-img-preview">
                            {product.image_url ? <img src={product.image_url} alt={product.name} /> : <Package size={40} />}
                        </div>
                        <div className="admin-card-content">
                            <h3>{product.name}</h3>
                            <p className="category-tag">{product.store_categories?.name || 'Sem Categoria'}</p>
                            <p className="price-tag">{product.price}€</p>
                            <div className="admin-card-actions">
                                <button onClick={() => loadProductForEdit(product)} className="action-btn edit"><Edit2 size={16} /></button>
                                <button onClick={() => handleDeleteProduct(product)} className="action-btn delete"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal Produto */}
            {editingProduct && (
                <div className="modal-overlay">
                    <div className="modal-content product-modal">
                        <div className="modal-header">
                            <h2>{editingProduct.id ? 'Editar Artigo' : 'Novo Artigo'}</h2>
                            <button onClick={() => setEditingProduct(null)} className="close-btn"><X /></button>
                        </div>
                        <form onSubmit={handleSaveProduct} className="modal-form">
                            <div className="form-row">
                                <div className="form-group flex-2">
                                    <label>Nome do Artigo</label>
                                    <input className="form-input" value={editingProduct.name} onChange={e => setEditingProduct({ ...editingProduct, name: e.target.value })} required />
                                </div>
                                <div className="form-group flex-1">
                                    <label>Preço (€)</label>
                                    <input type="number" step="0.01" className="form-input" value={editingProduct.price} onChange={e => setEditingProduct({ ...editingProduct, price: e.target.value })} required />
                                </div>
                            </div>

                            <div className="form-group">
                                <label>Categoria</label>
                                <select className="form-input" value={editingProduct.category_id} onChange={e => setEditingProduct({ ...editingProduct, category_id: e.target.value })}>
                                    <option value="">Selecionar...</option>
                                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Descrição</label>
                                <textarea className="form-input" value={editingProduct.description} onChange={e => setEditingProduct({ ...editingProduct, description: e.target.value })} rows={3} />
                            </div>

                            <div className="form-group grid-2-col">
                                <div>
                                    <label>Imagem Principal (Capa)</label>
                                    <div className="image-upload-wrapper">
                                        {editingProduct.image_url && (
                                            <div style={{ position: 'relative', width: 'fit-content' }}>
                                                <img src={editingProduct.image_url} alt="Preview" className="upload-preview" />
                                                <button 
                                                    type="button" 
                                                    onClick={handleRemoveImage} 
                                                    className="remove-img-btn"
                                                    title="Remover Capa"
                                                    disabled={loading}
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        )}
                                        <label className="image-upload-btn">
                                            <Camera size={20} /> Escolher Foto Capa
                                            <input type="file" accept="image/*" onChange={handleImageUpload} hidden />
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label>Galeria de Imagens Extras</label>
                                    <div className="image-gallery-wrapper">
                                        <div className="gallery-preview-grid">
                                            {editingProduct.gallery_urls?.map((url: string, index: number) => (
                                                <div key={index} className="gallery-thumbnail-container">
                                                    <img src={url} alt={`Gallery ${index}`} className="gallery-thumbnail" />
                                                    <div className="gallery-actions">
                                                        <button type="button" onClick={() => handleMakeCover(url)} className="make-cover-btn" title="Definir como Capa">Capa</button>
                                                        <button type="button" onClick={() => handleRemoveFromGallery(url)} className="remove-gallery-img-btn" title="Remover da Galeria"><X size={14} /></button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <label className="image-upload-btn">
                                            <Plus size={20} /> Adicionar Fotos à Galeria
                                            <input type="file" accept="image/*" multiple onChange={handleGalleryUpload} hidden disabled={loading} />
                                        </label>
                                    </div>
                                </div>
                            </div>

                            <div className="variants-section">
                                <div className="section-header">
                                    <h3>Variantes (Tamanhos/Cores/Stock)</h3>
                                    <button type="button" onClick={addVariant} className="add-variant-btn"><Plus size={14} /> Adicionar Opção</button>
                                </div>
                                <div className="variants-list">
                                    {variants.map((v, i) => (
                                        <div key={i} className="variant-row">
                                            <input placeholder="Tam (ex: A1)" className="form-input" value={v.size} onChange={e => updateVariant(i, 'size', e.target.value)} />
                                            <input placeholder="Cor (ex: Branco)" className="form-input" value={v.color} onChange={e => updateVariant(i, 'color', e.target.value)} />
                                            <input type="number" placeholder="Stock" className="form-input" value={v.stock_quantity} onChange={e => updateVariant(i, 'stock_quantity', parseInt(e.target.value))} />
                                            <button type="button" onClick={() => removeVariant(i)} className="delete-variant"><X size={14} /></button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn-secondary" onClick={() => setEditingProduct(null)}>Cancelar</button>
                                <button type="submit" className="btn-primary" disabled={loading}><Save size={18} /> Guardar Produto</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal Categorias */}
            {showCategoryModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div className="modal-header">
                            <h2>Gerir Categorias</h2>
                            <button onClick={() => setShowCategoryModal(false)} className="close-btn"><X /></button>
                        </div>
                        <div className="categories-admin">
                            <form onSubmit={handleSaveCategory} className="category-form">
                                <input className="form-input" placeholder="Nova Categoria" value={editingCategory.name || ''} onChange={e => setEditingCategory({ ...editingCategory, name: e.target.value })} required />
                                <button type="submit" className="btn-primary">{editingCategory.id ? 'Atualizar' : 'Adicionar'}</button>
                            </form>
                            <div className="category-list">
                                {categories.map(c => (
                                    <div key={c.id} className="category-item">
                                        <span>{c.name}</span>
                                        <div className="cat-actions">
                                            <button onClick={() => setEditingCategory(c)}><Edit2 size={14} /></button>
                                            <button onClick={async () => { if(confirm('Eliminar categoria?')) await supabase.from('store_categories').delete().eq('id', c.id); fetchData(); }}><Trash2 size={14} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <style>{`
                .admin-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
                .admin-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 1rem; overflow: hidden; display: flex; flex-direction: column; }
                .product-img-preview { height: 180px; background: #1a1a1a; display: flex; alignItems: center; justifyContent: center; overflow: hidden; }
                .product-img-preview img { width: 100%; height: 100%; object-fit: cover; }
                .admin-card-content { padding: 1.25rem; }
                .admin-card-content h3 { color: white; margin-bottom: 0.5rem; font-size: 1.1rem; }
                .category-tag { font-size: 0.75rem; color: var(--primary); background: rgba(16,185,129,0.1); display: inline-block; padding: 2px 8px; border-radius: 4px; margin-bottom: 0.75rem; }
                .price-tag { color: white; font-weight: 700; font-size: 1.25rem; margin-bottom: 1rem; }
                .admin-card-actions { display: flex; gap: 0.5rem; border-top: 1px solid var(--border); padding-top: 1rem; }
                .action-btn { flex: 1; padding: 0.5rem; border-radius: 0.5rem; cursor: pointer; display: flex; alignItems: center; justifyContent: center; }
                .edit { background: rgba(59,130,246,0.1); color: #3b82f6; border: 1px solid rgba(59,130,246,0.2); }
                .delete { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
                
                .product-modal { width: 90%; max-width: 700px; max-height: 90vh; overflow-y: auto; }
                .form-row { display: flex; gap: 1rem; }
                .flex-2 { flex: 2; }
                .flex-1 { flex: 1; }
                .grid-2-col { display: grid; grid-template-columns: 1fr; gap: 1.5rem; }
                @media (min-width: 640px) { .grid-2-col { grid-template-columns: 1fr 1fr; } }
                .image-upload-wrapper, .image-gallery-wrapper { display: flex; flex-direction: column; gap: 1rem; }
                .upload-preview { width: 150px; height: 150px; object-fit: cover; border-radius: 0.5rem; border: 1px solid var(--border); }
                .gallery-preview-grid { display: flex; flex-wrap: wrap; gap: 0.5rem; }
                .gallery-thumbnail-container { position: relative; width: 80px; height: 80px; border-radius: 0.5rem; overflow: hidden; border: 1px solid var(--border); }
                .gallery-thumbnail { width: 100%; height: 100%; object-fit: cover; }
                .gallery-actions { position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.7); display: flex; justifyContent: space-between; padding: 2px 4px; }
                .make-cover-btn { background: none; border: none; color: white; font-size: 0.6rem; cursor: pointer; }
                .remove-gallery-img-btn { background: none; border: none; color: var(--danger); cursor: pointer; }
                
                .remove-img-btn { position: absolute; top: -8px; right: -8px; background: var(--danger); color: white; border: none; border-radius: 50%; width: 24px; height: 24px; display: flex; alignItems: center; justifyContent: center; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.5); }
                .remove-img-btn:hover { transform: scale(1.1); }
                .remove-img-btn:disabled { opacity: 0.5; cursor: not-allowed; }
                .image-upload-btn { display: flex; alignItems: center; gap: 0.5rem; background: var(--border); color: white; padding: 0.5rem 1rem; border-radius: 0.5rem; cursor: pointer; width: fit-content; font-size: 0.875rem; }
                
                .variants-section { background: rgba(255,255,255,0.03); padding: 1rem; border-radius: 0.75rem; border: 1px solid var(--border); margin: 1.5rem 0; }
                .section-header { display: flex; justifyContent: space-between; alignItems: center; margin-bottom: 1rem; }
                .section-header h3 { font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; }
                .add-variant-btn { background: var(--primary); color: #000; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer; }
                .variant-row { display: grid; grid-template-columns: 1fr 1fr 80px 40px; gap: 0.5rem; margin-bottom: 0.5rem; }
                .delete-variant { background: rgba(239,68,68,0.1); color: #ef4444; border: none; border-radius: 4px; cursor: pointer; }
                
                .category-form { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
                .category-list { display: flex; flex-direction: column; gap: 0.5rem; }
                .category-item { display: flex; justifyContent: space-between; background: var(--bg-dark); padding: 0.75rem; border-radius: 0.5rem; border: 1px solid var(--border); }
                .cat-actions { display: flex; gap: 0.5rem; }
                .cat-actions button { background: none; border: none; color: var(--text-muted); cursor: pointer; }
                .cat-actions button:hover { color: white; }
            `}</style>
        </div>
    );
}

