import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import { 
  Package, 
  ArrowDownToLine, 
  ArrowUpFromLine, 
  History,
  AlertOctagon,
  Search,
  Warehouse
} from 'lucide-react';

interface Warehouse {
  id: number;
  name: string;
}

interface StockLevel {
  product_id: number;
  product_name: string;
  product_size: string;
  warehouse_id: number;
  warehouse_name: string;
  total_stock: number;
  closest_expiry: string;
  expiring_batches: number;
}

interface MovementLog {
  id: number;
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

export default function Inventory() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [activeTab, setActiveTab] = useState<'levels' | 'in' | 'out' | 'logs'>('levels');
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  // Data states
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [logs, setLogs] = useState<MovementLog[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Form states
  const [search, setSearch] = useState('');
  const [productId, setProductId] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [reference, setReference] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchWarehouses();
  }, []);

  useEffect(() => {
    if (activeTab === 'levels') fetchStockLevels();
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, search]);

  const fetchWarehouses = async () => {
    try {
      const res = await api.get('/api/inventory/warehouses');
      setWarehouses(res.data.warehouses);
      if (res.data.warehouses.length > 0) {
        setWarehouseId(res.data.warehouses[0].id.toString());
      }
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

  const handleStockSubmit = async (e: React.FormEvent, type: 'in' | 'out') => {
    e.preventDefault();
    setSubmitError('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      const payload = {
        product_id: parseInt(productId),
        warehouse_id: parseInt(warehouseId),
        quantity: parseInt(quantity),
        reference,
        batch_number: batchNumber || undefined,
        expiry_date: expiryDate ? new Date(expiryDate).toISOString() : undefined,
      };

      await api.post(`/api/inventory/${type}`, payload);
      setSuccessMsg(`Successfully logged stock ${type}!`);
      
      // Reset form
      setProductId('');
      setQuantity('');
      setReference('');
      setBatchNumber('');
      setExpiryDate('');
    } catch (err: any) {
      setSubmitError(err.response?.data?.error || 'Failed to submit movement');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isAdmin) {
    return <div className="p-12 text-center text-gray-500">Access Denied. Admin only.</div>;
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Advanced Inventory</h1>
          <p className="text-gray-500 mt-1">Manage physical stock, view batch tracking, and log immutable movements.</p>
        </div>
      </div>

      {/* Tabs */}
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
        
        {/* TAB: STOCK LEVELS */}
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
            </div>
            {loading ? <div className="p-12 text-center text-gray-500">Loading stock data...</div> : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Warehouse</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Total Stock</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Closest Expiry</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {stockLevels.length === 0 ? (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-500 text-sm">No stock found.</td></tr>
                  ) : stockLevels.map((s, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{s.product_name}</div>
                        <div className="text-xs text-gray-500">{s.product_size} | ID: {s.product_id}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {s.warehouse_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${s.total_stock <= 5 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                          {s.total_stock} Units
                        </span>
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* TAB: STOCK IN */}
        {activeTab === 'in' && (
          <div className="max-w-xl mx-auto p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
              <ArrowDownToLine className="w-6 h-6 text-indigo-600" />
              Receive New Stock
            </h2>
            
            {submitError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{submitError}</div>}
            {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{successMsg}</div>}

            <form onSubmit={(e) => handleStockSubmit(e, 'in')} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                  <input required type="number" min="1" value={productId} onChange={e => setProductId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input required type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Destination Warehouse</label>
                <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500 bg-white">
                  {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference (PO Number, Supplier, etc.)</label>
                <input required type="text" value={reference} onChange={e => setReference(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" placeholder="e.g. PO-2023-11A" />
              </div>

              <div className="border-t border-gray-100 pt-5 mt-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Optional Batch Tracking</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Batch Number</label>
                    <input type="text" value={batchNumber} onChange={e => setBatchNumber(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" placeholder="BATCH-123" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Expiry Date</label>
                    <input type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" />
                  </div>
                </div>
              </div>

              <button disabled={submitting} type="submit" className="w-full bg-indigo-600 text-white font-medium py-2.5 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 mt-4">
                {submitting ? 'Processing...' : 'Receive Stock Ledger'}
              </button>
            </form>
          </div>
        )}

        {/* TAB: STOCK OUT */}
        {activeTab === 'out' && (
          <div className="max-w-xl mx-auto p-8">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 flex items-center gap-2">
              <ArrowUpFromLine className="w-6 h-6 text-rose-600" />
              Dispatch / Remove Stock
            </h2>
            <p className="text-sm text-gray-500 mb-6">Use this to manually deduct stock for damages, expired goods, or internal transfers. Sales will automatically deduct stock.</p>
            
            {submitError && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">{submitError}</div>}
            {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg border border-green-100">{successMsg}</div>}

            <form onSubmit={(e) => handleStockSubmit(e, 'out')} className="space-y-5">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product ID</label>
                  <input required type="number" min="1" value={productId} onChange={e => setProductId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity to Remove</label>
                  <input required type="number" min="1" value={quantity} onChange={e => setQuantity(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source Warehouse</label>
                <select required value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:border-indigo-500 bg-white">
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

        {/* TAB: LOGS */}
        {activeTab === 'logs' && (
          <div className="p-0">
            {loading ? <div className="p-12 text-center text-gray-500">Loading immutable movement logs...</div> : (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Timestamp</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Qty Change</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Reference</th>
                    <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase">User</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {logs.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500 text-sm">No movement logs found.</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {log.product?.name}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 text-xs font-bold rounded ${
                          log.type === 'IN' ? 'bg-indigo-100 text-indigo-700' :
                          log.type === 'OUT' ? 'bg-rose-100 text-rose-700' :
                          'bg-amber-100 text-amber-700'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono font-bold text-sm">
                        {log.quantity > 0 ? <span className="text-indigo-600">+{log.quantity}</span> : <span className="text-rose-600">{log.quantity}</span>}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {log.reference}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-500">
                        {log.user ? log.user.name : 'System Generated'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
