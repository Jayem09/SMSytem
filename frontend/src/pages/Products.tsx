import { useState, useEffect, useCallback, type FormEvent } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

interface Category { id: number; name: string; }
interface Brand { id: number; name: string; }
interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  is_service?: boolean; // Label as service Item
  size?: string;
  parent_id?: number;
  category_id: number;
  brand_id: number;
  category?: Category;
  brand?: Brand;
  // Tech Specs
  pcd?: string;
  offset_et?: string;
  width?: string;
  bore?: string;
  finish?: string;
  speed_rating?: string;
  load_index?: string;
  dot_code?: string;
  ply_rating?: string;
}

export default function Products() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [error, setError] = useState('');

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [size, setSize] = useState('');
  const [parentId, setParentId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [isService, setIsService] = useState(false);

  // Tech Specs State
  const [pcd, setPcd] = useState('');
  const [offsetEt, setOffsetEt] = useState('');
  const [width, setWidth] = useState('');
  const [bore, setBore] = useState('');
  const [finish, setFinish] = useState('');
  const [speedRating, setSpeedRating] = useState('');
  const [loadIndex, setLoadIndex] = useState('');
  const [dotCode, setDotCode] = useState('');
  const [plyRating, setPlyRating] = useState('');

  // Filters
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBrand, setFilterBrand] = useState('');

  const [isImporting, setIsImporting] = useState(false);

  const fetchProducts = useCallback(async () => {
    try {
      const params: Record<string, string> = { all: '1' };
      if (search) params.search = search;
      if (filterCategory) params.category_id = filterCategory;
      if (filterBrand) params.brand_id = filterBrand;
      
      const res = await api.get('/api/products', { params });
      setProducts(res.data.products || []);
    } catch {
      setError('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, filterCategory, filterBrand]);

  const fetchMeta = useCallback(async () => {
    try {
      const [catRes, brandRes] = await Promise.all([
        api.get('/api/categories'),
        api.get('/api/brands'),
      ]);
      setCategories(catRes.data.categories || []);
      setBrands(brandRes.data.brands || []);
    } catch {
      setError('Failed to load metadata');
    }
  }, []);

  useEffect(() => { 
    fetchProducts(); 
    fetchMeta(); 
  }, [fetchProducts, fetchMeta]);

  // Debounced search is already handled by fetchProducts dependency on search/filters
  // but if we want to keep the timeout:
  useEffect(() => { 
    const t = setTimeout(fetchProducts, 300); 
    return () => clearTimeout(t); 
  }, [fetchProducts]);

  const openCreate = () => {
    setEditing(null);
    setName(''); setDescription(''); setPrice(''); setStock('0');
    setSize(''); setParentId('');
    setCategoryId(''); setBrandId('');
    setIsService(false);
    // Reset Specs
    setPcd(''); setOffsetEt(''); setWidth(''); setBore(''); setFinish('');
    setSpeedRating(''); setLoadIndex(''); setDotCode(''); setPlyRating('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditing(p);
    setName(p.name);
    setDescription(p.description);
    setPrice(String(p.price));
    setStock(String(p.stock));
    setSize(p.size || '');
    setParentId(p.parent_id ? String(p.parent_id) : '');
    setCategoryId(String(p.category_id));
    setBrandId(String(p.brand_id));
    setIsService(!!p.is_service);
    // Populate Specs
    setPcd(p.pcd || ''); setOffsetEt(p.offset_et || ''); setWidth(p.width || '');
    setBore(p.bore || ''); setFinish(p.finish || ''); setSpeedRating(p.speed_rating || '');
    setLoadIndex(p.load_index || ''); setDotCode(p.dot_code || ''); setPlyRating(p.ply_rating || '');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      name,
      description,
      price: parseFloat(price),
      stock: parseInt(stock),
      size,
      parent_id: parentId ? parseInt(parentId) : null,
      category_id: parseInt(categoryId),
      brand_id: parseInt(brandId),
      is_service: isService,
      pcd,
      offset_et: offsetEt,
      width,
      bore,
      finish,
      speed_rating: speedRating,
      load_index: loadIndex,
      dot_code: dotCode,
      ply_rating: plyRating,
    };
    try {
      if (editing) {
        await api.put(`/api/products/${editing.id}`, payload);
      } else {
        await api.post('/api/products', payload);
      }
      setModalOpen(false);
      fetchProducts();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else {
        setError('Operation failed');
      }
    }
  };

  const openDetails = (p: Product) => {
    setViewingProduct(p);
    setDetailsModalOpen(true);
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Delete product "${p.name}"?`)) return;
    try {
      await api.delete(`/api/products/${p.id}`);
      fetchProducts();
    } catch {
      alert('Failed to delete product');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setIsImporting(true);
    setError('');
    try {
      const res = await api.post('/api/products/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      alert(res.data.message);
      fetchProducts();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      if (axiosError.response?.data?.error) {
        setError(axiosError.response.data.error);
      } else {
        setError('Import failed');
      }
    } finally {
      setIsImporting(false);
      e.target.value = '';
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Products</h1>
        <div className="flex gap-2">
          <select 
            value={filterCategory} 
            onChange={(e) => setFilterCategory(e.target.value)}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select 
            value={filterBrand} 
            onChange={(e) => setFilterBrand(e.target.value)}
            className="text-sm border-gray-300 rounded-md shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="">All Brands</option>
            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          {isAdmin && (
            <>
              <label className={`px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md cursor-pointer ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}>
                {isImporting ? 'Importing...' : 'Bulk Import (CSV)'}
                <input type="file" accept=".csv" className="hidden" onChange={handleImport} disabled={isImporting} />
              </label>
              <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
                Add Product
              </button>
            </>
          )}
        </div>
      </div>

      {error && !modalOpen && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <DataTable
        columns={[
          { key: 'name', label: 'Name', render: (p) => (
            <div>
              <div className="font-medium text-gray-900">{p.name}</div>
              {p.size && <div className="text-xs text-gray-400">{p.size}</div>}
              {p.finish && <div className="text-[10px] text-gray-400 italic">{p.finish}</div>}
            </div>
          )},
          { key: 'category', label: 'Category', render: (p) => p.category?.name || '--' },
          { key: 'brand', label: 'Brand', render: (p) => p.brand?.name || '--' },
          { key: 'type', label: 'Type', render: (p) => p.is_service ? <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-[10px] font-black uppercase tracking-widest">Service</span> : <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-[10px] font-black uppercase tracking-widest">Item</span> },
          // Dynamic Columns based on filter
          ...(categories.find(c => String(c.id) === filterCategory)?.name?.toLowerCase()?.includes('mags') ? [
            { key: 'pcd', label: 'PCD', render: (p: Product) => p.pcd || '--' },
            { key: 'offset', label: 'ET', render: (p: Product) => p.offset_et || '--' },
            { key: 'width', label: 'Width', render: (p: Product) => p.width || '--' },
          ] : []),
          ...(categories.find(c => String(c.id) === filterCategory)?.name?.toLowerCase()?.includes('tire') ? [
            { key: 'speed', label: 'Speed', render: (p: Product) => p.speed_rating || '--' },
            { key: 'load', label: 'Load', render: (p: Product) => p.load_index || '--' },
          ] : []),
          { key: 'price', label: 'Price', render: (p) => `P ${p.price.toLocaleString()}` },
          { key: 'stock', label: 'Stock', render: (p) => (
            p.is_service ? <span className="text-gray-400 font-bold">N/A</span> :
            <span className={p.stock <= 5 ? 'text-red-600 font-medium' : ''}>{p.stock}</span>
          )},
        ]}
        data={products}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search products..."
        onView={openDetails}
        onEdit={isAdmin ? openEdit : undefined}
        onDelete={isAdmin ? handleDelete : undefined}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'New Product'} maxWidth="max-w-4xl">
        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <FormField label="Name" value={name} onChange={setName} required placeholder="Product name" />
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-4">
              <FormField label="Description" type="textarea" value={description} onChange={setDescription} />
              <div className="grid grid-cols-2 gap-3 items-end">
                <FormField label="Price" type="number" value={price} onChange={setPrice} required min={0} step="0.01" />
                
                {!isService && (
                  <FormField label="Stock" type="number" value={stock} onChange={setStock} required min={0} />
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Size (Optional)" value={size} onChange={setSize} placeholder="e.g. 225/45 R17" />
                <FormField
                  label="Parent Model (Optional)"
                  type="select"
                  value={parentId}
                  onChange={setParentId}
                  options={[
                    { value: '', label: 'None (Top level)' },
                    ...products.filter(p => !p.parent_id && p.id !== editing?.id).map(p => ({ value: p.id, label: p.name }))
                  ]}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="Category"
                  type="select"
                  value={categoryId}
                  onChange={setCategoryId}
                  required
                  options={categories.map((c) => ({ value: c.id, label: c.name }))}
                />
                <FormField
                  label="Brand"
                  type="select"
                  value={brandId}
                  onChange={setBrandId}
                  required
                  options={brands.map((b) => ({ value: b.id, label: b.name }))}
                />
              </div>

              <div className="mt-4 flex items-center gap-2">
                 <input 
                   type="checkbox" 
                   id="isServiceToggle"
                   checked={isService}
                   onChange={(e) => setIsService(e.target.checked)}
                   className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500"
                 />
                 <label htmlFor="isServiceToggle" className="text-sm font-medium text-gray-700 select-none cursor-pointer">
                   This is a Service / Labor Item (No stock tracking)
                 </label>
              </div>
            </div>
          </div>

          {/* Dynamic Technical Specs */}
          {!isService && categories.find(c => String(c.id) === categoryId)?.name?.toLowerCase()?.includes('tire') && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
              <p className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">Tire Specifications</p>
              <div className="grid grid-cols-4 gap-4">
                <FormField label="Speed Rating" value={speedRating} onChange={setSpeedRating} placeholder="e.g. V, H, W" />
                <FormField label="Load Index" value={loadIndex} onChange={setLoadIndex} placeholder="e.g. 91, 104" />
                <FormField label="Ply Rating" value={plyRating} onChange={setPlyRating} placeholder="e.g. 10PR" />
                <FormField label="DOT Code" value={dotCode} onChange={setDotCode} placeholder="e.g. 1223" />
              </div>
            </div>
          )}

          {!isService && categories.find(c => String(c.id) === categoryId)?.name?.toLowerCase()?.includes('mags') && (
            <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 mb-4">
              <p className="text-xs font-black text-gray-400 mb-4 uppercase tracking-[0.2em]">Mags Specifications</p>
              <div className="grid grid-cols-2 gap-6">
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="PCD" value={pcd} onChange={setPcd} placeholder="e.g. 5x114.3" />
                  <FormField label="Offset (ET)" value={offsetEt} onChange={setOffsetEt} placeholder="e.g. 45" />
                  <FormField label="Width" value={width} onChange={setWidth} placeholder="e.g. 8.5J" />
                  <FormField label="Center Bore" value={bore} onChange={setBore} placeholder="e.g. 73.1" />
                </div>
                <FormField label="Finish" value={finish} onChange={setFinish} placeholder="e.g. Matte Black" />
              </div>
            </div>
          )}

          <button type="submit" className="w-full mt-2 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
            {editing ? 'Update' : 'Create'}
          </button>
        </form>
      </Modal>

      <Modal open={detailsModalOpen} onClose={() => setDetailsModalOpen(false)} title="Product Details" maxWidth="max-w-2xl">
        {viewingProduct && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Name</p>
                <p className="text-sm text-gray-900">{viewingProduct.name}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Price</p>
                <p className="text-sm text-gray-900">P {viewingProduct.price.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Category</p>
                <p className="text-sm text-gray-900">{viewingProduct.category?.name || '--'}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Brand</p>
                <p className="text-sm text-gray-900">{viewingProduct.brand?.name || '--'}</p>
              </div>
            </div>

            {viewingProduct.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase">Description</p>
                <p className="text-sm text-gray-600 italic">{viewingProduct.description}</p>
              </div>
            )}

            {(viewingProduct.pcd || viewingProduct.offset_et || viewingProduct.width || viewingProduct.bore || viewingProduct.finish) && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Mags Specifications</p>
                <div className="grid grid-cols-2 gap-y-2">
                  <div><span className="text-xs text-gray-400">PCD:</span> <span className="text-sm">{viewingProduct.pcd || '--'}</span></div>
                  <div><span className="text-xs text-gray-400">Offset (ET):</span> <span className="text-sm">{viewingProduct.offset_et || '--'}</span></div>
                  <div><span className="text-xs text-gray-400">Width:</span> <span className="text-sm">{viewingProduct.width || '--'}</span></div>
                  <div><span className="text-xs text-gray-400">Center Bore:</span> <span className="text-sm">{viewingProduct.bore || '--'}</span></div>
                  <div className="col-span-2"><span className="text-xs text-gray-400">Finish:</span> <span className="text-sm">{viewingProduct.finish || '--'}</span></div>
                </div>
              </div>
            )}

            {(viewingProduct.size || viewingProduct.speed_rating || viewingProduct.load_index || viewingProduct.dot_code || viewingProduct.ply_rating) && (
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-100">
                <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Tire Specifications</p>
                <div className="grid grid-cols-2 gap-y-2">
                  <div><span className="text-xs text-gray-400">Size:</span> <span className="text-sm">{viewingProduct.size || '--'}</span></div>
                  <div><span className="text-xs text-gray-400">Speed Rating:</span> <span className="text-sm">{viewingProduct.speed_rating || '--'}</span></div>
                  <div><span className="text-xs text-gray-400">Load Index:</span> <span className="text-sm">{viewingProduct.load_index || '--'}</span></div>
                  <div><span className="text-xs text-gray-400">Ply Rating:</span> <span className="text-sm">{viewingProduct.ply_rating || '--'}</span></div>
                  <div className="col-span-2"><span className="text-xs text-gray-400">DOT Code:</span> <span className="text-sm">{viewingProduct.dot_code || '--'}</span></div>
                </div>
              </div>
            )}
            
            <button onClick={() => setDetailsModalOpen(false)} className="w-full mt-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md">
              Close
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
