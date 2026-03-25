import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import * as XLSX from 'xlsx';
import { 
  Package, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  History,
  AlertOctagon,
  Search,
  Warehouse,
  MoreVertical,
  FileDown,
  X
} from 'lucide-react';
import { useToast } from '../context/ToastContext';
import BatchHistoryModal from '../components/BatchHistoryModal';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { Skeleton, SkeletonTable, SkeletonList } from '../components/EmptyState';

interface Warehouse {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  size: string;
}

interface StockLevel {
  product_id: number;
  product_name: string;
  product_size: string;
  warehouse_id: number;
  warehouse_name: string;
  total_stock: number;
  in_transit_stock: number;
  closest_expiry: string;
  expiring_batches: number;
}

interface MovementLog {
  id: number;
  batch_id: number;
  product_id: number;
  warehouse_id: number;
  type: string;
  quantity: number;
  reference: string;
  created_at: string;
  product: { name: string; size: string };
  warehouse: { name: string };
  user: { name: string } | null;
}


interface ItemInput {
  product_id: number;
  quantity: number;
  unit_cost: number;
}

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'purchasing' || user?.role === 'purchaser';
  const [activeTab, setActiveTab] = useState<'levels' | 'in' | 'out' | 'logs'>('levels');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [logs, setLogs] = useState<MovementLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  
  const [search, setSearch] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [reference, setReference] = useState('');
  
  
  const [items, setItems] = useState<ItemInput[]>([{ product_id: 0, quantity: 1, unit_cost: 0 }]);
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);

  
  const [productId, setProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const { showToast } = useToast();

  
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const [editLog, setEditLog] = useState<MovementLog | null>(null);
  const [editQty, setEditQty] = useState('');
  const [editRef, setEditRef] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

  
  const [expandedProduct, setExpandedProduct] = useState<number | null>(null);
  const [productBatches, setProductBatches] = useState<any[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);

  useEffect(() => {
    fetchWarehouses();
    fetchSuppliers();
    fetchProducts('');
  }, []);

  useEffect(() => {
    fetchProducts(productSearch);
  }, [productSearch]);

  useEffect(() => {
    if (activeTab === 'levels') fetchStockLevels();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, search]);

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/api/inventory/warehouses');
      setWarehouses(res.data?.warehouses || []);
      if ((res.data?.warehouses || []).length > 0) {
        setWarehouseId(res.data.warehouses[0].id.toString());
      }
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/api/suppliers');
      setSuppliers(res.data.suppliers || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchProducts = async (search: string) => {
    try {
      const res = await api.get(`/api/products?search=${search}&all=1`);
      setProducts(res.data.products || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStockLevels = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/inventory/levels?search=${search}`);
      setStockLevels(res.data.levels || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/inventory/logs');
      setLogs(res.data.logs || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = () => {
    const rows = logs.map(log => ({
      'Date': new Date(log.created_at).toLocaleString(),
      'Product': log.product?.name || '',
      'Size': log.product?.size || '',
      'Type': log.type,
      'Qty Change': log.quantity,
      'Warehouse': log.warehouse?.name || '',
      'Reference': log.reference,
      'User': log.user ? log.user.name : 'System',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Movement Logs');
    XLSX.writeFile(wb, `stock-movements-${new Date().toISOString().slice(0,10)}.xlsx`);
  };

  const handleAdjust = async () => {
    if (!editLog) return;
    setEditError('');
    setEditSubmitting(true);
    try {
      await api.post('/api/inventory/adjust', {
        batch_id: editLog.batch_id,
        new_quantity: Math.abs(editLog.quantity) + (parseInt(editQty) - Math.abs(editLog.quantity)),
        reference: editRef,
      });
      setEditLog(null);
      fetchLogs();
    } catch (err: any) {
      setEditError(err.response?.data?.error || 'Failed to update');
    } finally {
      setEditSubmitting(false);
    }
  };

  
  const addItem = () => setItems([...items, { product_id: 0, quantity: 1, unit_cost: 0 }]);
  const removeItem = (index: number) => setItems(items.filter((_, i) => i !== index));
  const updateItem = (index: number, field: keyof ItemInput, value: number) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };
  const totalCost = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

  const handleStockSubmit = async (e: React.FormEvent, type: 'in' | 'out') => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (type === 'in') {
        const validItems = items.filter(item => item.product_id > 0 && item.quantity > 0);
        if (validItems.length === 0) {
          showToast('Add at least one complete item (product and quantity).', 'error');
          setSubmitting(false);
          return;
        }

        const payload = {
          supplier_id: supplierId ? parseInt(supplierId) : null,
          order_date: orderDate,
          notes: reference,
          items: validItems
        };
        await api.post('/api/purchase-orders', payload);
        showToast('Successfully created a new Pending Purchase Order!', 'success');
        
        
        setSupplierId('');
        setOrderDate(new Date().toISOString().split('T')[0]);
        setReference('');
        setItems([{ product_id: 0, quantity: 1, unit_cost: 0 }]);
      } else {
        const payload = {
          product_id: parseInt(productId),
          warehouse_id: parseInt(warehouseId),
          quantity: parseInt(quantity),
          reference,
          batch_number: batchNumber || undefined,
          expiry_date: expiryDate ? new Date(expiryDate).toISOString() : undefined,
        };
        await api.post(`/api/inventory/out`, payload);
        showToast(`Successfully logged stock out!`, 'success');
        
        
        setProductId('');
        setQuantity('');
        setReference('');
        setBatchNumber('');
        setExpiryDate('');
      }
    } catch (err: any) {
      showToast(err.response?.data?.error || 'Failed to submit', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return <div className="p-12 text-center text-gray-500">Access Denied. Admin only.</div>;
  }

  return (
    <div className="p-6 mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Advanced Inventory</h1>
          <p className="text-gray-500 mt-1">Manage physical stock, view batch tracking, and log immutable movements.</p>
        </div>
      </div>

      {}
      <div className="flex space-x-1 border-b border-gray-200">
        {[
          { id: 'levels', label: 'Stock Levels', icon: Package },
          { id: 'in', label: 'Stock In (Receive)', icon: ArrowDownToLine },
          { id: 'out', label: 'Stock Out (Dispatch)', icon: ArrowUpFromLine },
          { id: 'logs', label: 'Movement Logs', icon: History }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id 
              ? 'border-indigo-600 text-indigo-600' 
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <tab.icon className="w-4 h-4 mr-2" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm min-h-[500px]">
        
        {}
        {activeTab === 'levels' && (
          <div className="p-0">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div className="relative w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input 
                  type="text" 
                  placeholder="Search products..." 
                  className="pl-9 pr-4 py-2 w-full border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <button 
                onClick={async () => {
                  try {
                    const res = await api.post('/api/inventory/generate-pos');
                    showToast(res.data.message, 'success');
                  } catch (err: any) {
                    showToast(err.response?.data?.error || 'Failed to generate POs', 'error');
                  }
                }}
                className="text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg border border-indigo-100 transition-colors"
              >
                Prepare Draft POs
              </button>
            </div>
            {loading ? <SkeletonTable rows={6} cols={6} /> : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Warehouse</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">On Hand</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">In Transit</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Expiring</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Closest Expiry</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {stockLevels.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500 text-sm">No stock found.</td></tr>
                  ) : stockLevels.map((s, i) => (
                    <React.Fragment key={i}>
                    <tr key={i} className={`hover:bg-gray-50 transition-colors cursor-pointer ${expandedProduct === s.product_id ? 'bg-indigo-50/30' : ''}`} onClick={async () => {
                      if (expandedProduct === s.product_id) {
                        setExpandedProduct(null);
                        setProductBatches([]);
                      } else {
                        setExpandedProduct(s.product_id);
                        setBatchLoading(true);
                        try {
                          const res = await api.get(`/api/inventory/batches?product_id=${s.product_id}&warehouse_id=${s.warehouse_id}`);
                          setProductBatches(res.data.batches || []);
                        } catch (err) {
                          console.error(err);
                        } finally {
                          setBatchLoading(false);
                        }
                      }
                    }}>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-gray-100 p-1.5 rounded-lg text-gray-400">
                            {expandedProduct === s.product_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900">{s.product_name}</div>
                            <div className="text-xs text-gray-500">{s.product_size} | ID: {s.product_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {s.warehouse_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.total_stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {s.total_stock} Units
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {s.in_transit_stock > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">
                            +{s.in_transit_stock} Shipped
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">--</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {s.expiring_batches > 0 ? (
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-700">
                            {s.expiring_batches} batches
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">OK</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {s.closest_expiry ? (
                          <div className="flex items-center gap-2">
                            <AlertOctagon className="w-4 h-4 text-orange-500" />
                            {new Date(s.closest_expiry).toLocaleDateString()}
                          </div>
                        ) : 'No expiry tracked'}
                      </td>
                    </tr>
                    {expandedProduct === s.product_id && (
                      <tr className="bg-white">
                        <td colSpan={6} className="px-12 py-4">
                          <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                            <div className="bg-gray-50 px-4 py-2 border-b border-gray-100 flex justify-between items-center">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Active Batches for Replenishment</span>
                              {batchLoading && <span className="text-[10px] text-indigo-500 font-bold animate-pulse">Syncing...</span>}
                            </div>
                            <table className="min-w-full">
                              <thead className="bg-white">
                                <tr className="border-b border-gray-50">
                                  <th className="px-4 py-2 text-left text-[10px] font-black text-gray-400 uppercase">Batch Number</th>
                                  <th className="px-4 py-2 text-left text-[10px] font-black text-gray-400 uppercase">Quantity</th>
                                  <th className="px-4 py-2 text-left text-[10px] font-black text-gray-400 uppercase">Expiry</th>
                                  <th className="px-4 py-2"></th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-50">
                                {productBatches.length === 0 && !batchLoading ? (
                                  <tr><td colSpan={4} className="px-4 py-6 text-center text-xs text-gray-400 font-medium italic">No active batches detected for this location.</td></tr>
                                ) : productBatches.map(b => (
                                  <tr key={b.id} className="hover:bg-indigo-50/30">
                                    <td className="px-4 py-3 text-sm font-bold text-gray-900 font-mono tracking-tighter">{b.batch_number}</td>
                                    <td className="px-4 py-3 text-sm font-black text-gray-600">{b.quantity}</td>
                                    <td className="px-4 py-3 text-xs text-gray-500 font-medium">
                                      {b.expiry_date ? new Date(b.expiry_date).toLocaleDateString() : 'N/A'}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <button 
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setSelectedBatch({
                                            id: b.id,
                                            batch_number: b.batch_number,
                                            product_name: s.product_name
                                          });
                                          setHistoryModalOpen(true);
                                        }}
                                        className="inline-flex items-center gap-2 px-3 py-1 bg-gray-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-sm"
                                      >
                                        <Activity className="w-3 h-3" />
                                        Audit History
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {}
        {activeTab === 'in' && (
          <div className="max-w-xl mx-auto p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
              <ArrowDownToLine className="w-6 h-6 text-indigo-600" />
              Receive New Stock
            </h2>
            

            <form onSubmit={(e) => handleStockSubmit(e, 'in')} className="space-y-5">
              <div className="bg-blue-50 text-blue-800 text-sm p-4 rounded-lg border border-blue-100 flex items-start gap-2">
                <span className="text-xl">ℹ️</span>
                <p><strong>Note:</strong> Receiving stock here will create a <strong>Pending Purchase Order</strong>. You will need to go to the Purchase Orders page to Mark as Received when the goods physically arrive.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Optional Supplier</label>
                  <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm  outline-none focus:border-indigo-500 bg-white">
                    <option value="">-- No Supplier --</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Order Date <span className="text-red-500">*</span></label>
                  <input required type="date" value={orderDate} onChange={e => setOrderDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Notes</label>
                <input type="text" value={reference} onChange={e => setReference(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500" placeholder="Optional notes" />
              </div>

              {}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3 border-b border-gray-200 pb-2">
                  <label className="text-sm font-semibold text-gray-900">Purchase Order Items</label>
                  <button type="button" onClick={addItem} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1 rounded-md transition-colors">
                    + Add Item
                  </button>
                </div>

                <div className="space-y-3">
                  {items.map((item, index) => (
                    <div key={index} className="flex gap-3 items-start bg-gray-50/50 p-3 rounded-lg border border-gray-100 relative group">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Product</label>
                        <select
                          required
                          value={item.product_id}
                          onChange={(e) => updateItem(index, 'product_id', parseInt(e.target.value))}
                          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                        >
                          <option value={0}>Select product...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}{p.size ? ` (${p.size})` : ''}</option>
                          ))}
                        </select>
                      </div>
                      <div className="w-20 lg:w-24">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Qty</label>
                        <input
                          required
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(index, 'quantity', parseInt(e.target.value) || 1)}
                          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                        />
                      </div>
                      <div className="w-24 lg:w-32">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Unit Cost</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unit_cost}
                          onChange={(e) => updateItem(index, 'unit_cost', parseFloat(e.target.value) || 0)}
                          className="w-full px-3 py-2 rounded-md border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 bg-white"
                        />
                      </div>
                      <div className="w-24 text-right pt-1 hidden md:block">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Subtotal</label>
                        <span className="text-sm font-medium text-gray-900 block mt-2">
                          ₱{(item.quantity * item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      {items.length > 1 && (
                        <button 
                          type="button" 
                          onClick={() => removeItem(index)} 
                          className="absolute -right-2 -top-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 shadow-sm"
                          title="Remove item"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <div className="flex justify-end mt-4 pt-4 border-t border-gray-200">
                  <div className="text-right">
                    <span className="text-sm text-gray-500 mr-2">Total Estimated Cost:</span>
                    <span className="text-lg font-bold text-gray-900">
                      ₱{totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-4">
                {submitting ? 'Processing...' : 'Create Pending Purchase Order'}
              </button>
            </form>
          </div>
        )}

        {}
        {activeTab === 'out' && (
          <div className="max-w-xl mx-auto p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
              <ArrowUpFromLine className="w-6 h-6 text-rose-600" />
              Dispatch / Remove Stock
            </h2>
            <p className="text-sm text-gray-500 mb-6">Use this to manually deduct stock for damages, expired goods, or internal transfers. Sales will automatically deduct stock.</p>
            

            <form onSubmit={(e) => handleStockSubmit(e, 'out')} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <input
                  type="text"
                  placeholder="Search product name..."
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setProductId(''); }}
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500 mb-1"
                />
                <select required value={productId} onChange={e => setProductId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500 bg-white">
                  <option value="">-- Select a product --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}{p.size ? ` (${p.size})` : ''}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Remove</label>
                <input required type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Warehouse</label>
                <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2.5 text-sm outline-none focus:border-indigo-500 bg-white">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason (Reference)</label>
                <input required type="text" value={reference} onChange={e => setReference(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" placeholder="e.g. Damaged Goods Report #42" />
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-rose-600 text-white font-medium py-2.5 rounded-lg hover:bg-rose-700 transition-colors disabled:opacity-50 mt-4">
                {submitting ? 'Processing...' : 'Deduct Stock Ledger'}
              </button>
            </form>
          </div>
        )}

        {}
        {activeTab === 'logs' && (
          <div className="p-0">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <p className="text-sm text-gray-500">Full audit trail of all stock movements.</p>
              <button
                onClick={exportToExcel}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700 transition-colors"
              >
                <FileDown className="w-4 h-4" />
                Export Excel
              </button>
            </div>
            {loading ? <SkeletonTable rows={8} cols={7} /> : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Qty Change</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr><td colSpan={7} className="p-6 text-center text-gray-500 text-sm">No movement logs found.</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-xs text-gray-500">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {log.product?.name}
                        {log.product?.size && <span className="text-xs text-gray-400 ml-1">({log.product.size})</span>}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          log.type === 'IN' ? 'bg-indigo-100 text-indigo-700' :
                          log.type === 'OUT' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>{log.type}</span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-sm">
                        {log.quantity > 0 ? <span className="text-indigo-600">+{log.quantity}</span> : <span className="text-rose-600">{log.quantity}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{log.reference}</td>
                      <td className="px-6 py-4 text-xs text-gray-500">{log.user ? log.user.name : 'System Generated'}</td>
                      <td className="px-4 py-4 text-right relative">
                        <button
                          onClick={() => setOpenMenuId(openMenuId === log.id ? null : log.id)}
                          className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openMenuId === log.id && (
                          <div className="absolute right-8 top-8 z-50 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                            <button
                              onClick={() => {
                                setEditLog(log);
                                setEditQty(String(Math.abs(log.quantity)));
                                setEditRef(log.reference);
                                setEditError('');
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              ✏️ Edit Entry
                            </button>
                            <button
                              onClick={() => {
                                const row = [{
                                  'Date': new Date(log.created_at).toLocaleString(),
                                  'Product': log.product?.name || '',
                                  'Size': log.product?.size || '',
                                  'Type': log.type,
                                  'Qty Change': log.quantity,
                                  'Warehouse': log.warehouse?.name || '',
                                  'Reference': log.reference,
                                  'User': log.user ? log.user.name : 'System',
                                }];
                                const ws = XLSX.utils.json_to_sheet(row);
                                const wb = XLSX.utils.book_new();
                                XLSX.utils.book_append_sheet(wb, ws, 'Movement');
                                XLSX.writeFile(wb, `stock-entry-${log.id}.xlsx`);
                                setOpenMenuId(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                            >
                              📥 Download Excel
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>

      {}
      {editLog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Edit Stock Entry</h3>
              <button onClick={() => setEditLog(null)} className="p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Product: <strong>{editLog.product?.name}</strong> — This creates an adjustment log entry.
            </p>
            {editError && <div className="mb-3 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{editError}</div>}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Quantity</label>
                <input
                  type="number" min="0" value={editQty}
                  onChange={e => setEditQty(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Edit</label>
                <input
                  type="text" value={editRef}
                  onChange={e => setEditRef(e.target.value)}
                  placeholder="e.g. Correction - counted wrong"
                  className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setEditLog(null)} className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  onClick={handleAdjust}
                  disabled={editSubmitting}
                  className="flex-1 bg-indigo-600 text-white rounded-lg py-2 text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  {editSubmitting ? 'Saving...' : 'Save Adjustment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <BatchHistoryModal 
        open={historyModalOpen}
        onClose={() => setHistoryModalOpen(false)}
        batchId={selectedBatch?.id}
        batchNumber={selectedBatch?.batch_number}
        productName={selectedBatch?.product_name}
      />
    </div>
  );
}
