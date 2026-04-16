import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import { Package, Plus, CheckCircle, Truck, XCircle, Search, Inbox } from 'lucide-react';
import { useToast } from '../context/ToastContext';
import { getIsOfflineMode } from '../context/AuthContext';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { enqueueSyncItem } from '../services/syncQueue';
import { buildTransferCreateQueueItem } from '../services/offlineQueueBuilders';

interface Product {
  id: number;
  name: string;
  category?: { name: string };
  stock: number;
  price: number;
  is_service?: boolean;
}

interface TransferItem {
  id: number;
  product_id: number;
  quantity: number;
  product?: Product;
}

interface Transfer {
  id: number;
  reference_number: string;
  source_branch_id: number;
  destination_branch_id: number;
  status: string;
  notes: string;
  created_at: string;
  items: TransferItem[];
  source_branch?: { name: string };
  destination_branch?: { name: string };
  requested_by_user?: { name: string };
}

interface Branch {
  id: number;
  name: string;
}

export default function Transfers() {
  const { user } = useAuth();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'sender' | 'receiver' | 'all'>('sender');
  const [branchFilter, setBranchFilter] = useState('ALL');

  
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [targetBranchId, setTargetBranchId] = useState('');
  const [notes, setNotes] = useState('');
  const [requestItems, setRequestItems] = useState<{product_id: number, quantity: number, product?: Product, _edited?: boolean}[]>([]);
  const [productSearch, setProductSearch] = useState('');
  
  
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<Transfer | null>(null);

  
  const { showToast } = useToast();

  const isSuperAdmin = user?.role?.toLowerCase() === 'super_admin';
  const myBranchId = user?.branch_id ? Number(user.branch_id) : null;
  const focusBranchId = isSuperAdmin ? (branchFilter === 'ALL' ? null : Number(branchFilter)) : myBranchId;

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchFilter, user?.id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const branchQuery = isSuperAdmin ? (branchFilter === 'ALL' ? '' : `?branch_id=${branchFilter}`) : '';
      
      const results = await Promise.allSettled([
        api.get(`/api/transfers${branchQuery}`),
        api.get('/api/branches'),
        api.get('/api/products?all=1')
      ]);

      if (results[0].status === 'fulfilled') {
        const res = (results[0] as PromiseFulfilledResult<{ data: { transfers?: Transfer[] } }>).value;
        setTransfers(res.data.transfers || []);
      }

      if (results[1].status === 'fulfilled') {
        const branchesRes = (results[1] as PromiseFulfilledResult<{ data: { branches?: Branch[] } }>).value;
        setBranches(branchesRes.data.branches || []);
      }

      if (results[2].status === 'fulfilled') {
        const productsRes = (results[2] as PromiseFulfilledResult<{ data: { products?: Product[] } }>).value;
        setProducts(productsRes.data.products || []);
      }

    } catch (err: unknown) {
      console.error('Failed to fetch transfers data', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-blue-100 text-blue-800';
      case 'in_transit': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'rejected':
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    const performUpdate = async () => {
      try {
        await api.put(`/api/transfers/${id}/status`, { status: newStatus });
        
        const statusLabel = newStatus.replace('_', ' ').toUpperCase();
        showToast(`Transfer Status Updated: ${statusLabel}`, 'success');

        fetchData();
        window.dispatchEvent(new Event('transfer_updated'));
        if (selectedTransfer && selectedTransfer.id === id) {
          setSelectedTransfer({ ...selectedTransfer, status: newStatus });
          if (newStatus === 'completed' || newStatus === 'rejected' || newStatus === 'cancelled') {
              setTimeout(() => setViewModalOpen(false), 500);
          }
        }
      } catch (err: unknown) {
        const e = err as { response?: { data?: { error?: string; details?: string } } };
        const errorMsg = e.response?.data?.error || 'Failed to update transfer status';
        const details = e.response?.data?.details ? `: ${e.response.data.details}` : '';
        showToast(`${errorMsg}${details}`, 'error');
      }
    };

    // Execute directly — window.confirm() doesn't work in Tauri WebView
    performUpdate();
  };

  const submitRequest = async () => {
    if (!targetBranchId || requestItems.length === 0) {
      showToast('Please select a branch and add at least one item', 'error');
      return;
    }

    if (!myBranchId) {
      showToast('Your account does not have an assigned branch', 'error');
      return;
    }

    const items = requestItems.map((item) => ({ product_id: item.product_id, quantity: item.quantity }));

    if (getIsOfflineMode()) {
      enqueueSyncItem(buildTransferCreateQueueItem({
        sourceBranchId: parseInt(targetBranchId),
        destinationBranchId: myBranchId,
        notes,
        items,
      }));

      setRequestModalOpen(false);
      setRequestItems([]);
      setNotes('');
      setTargetBranchId('');
      window.dispatchEvent(new Event('transfer_updated'));
      showToast('Transfer request queued for sync when online', 'success');
      return;
    }
    
    try {
      await api.post('/api/transfers', {
        source_branch_id: parseInt(targetBranchId),
        destination_branch_id: myBranchId,
        notes: notes,
        items,
      });
      setRequestModalOpen(false);
      fetchData();
      setRequestItems([]);
      setNotes('');
      setTargetBranchId('');
      window.dispatchEvent(new Event('transfer_updated'));
      showToast('Transfer request sent successfully!', 'success');
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      showToast(e.response?.data?.error || 'Failed to submit request', 'error');
    }
  };

  const addRequestItem = (product: Product) => {
    if (requestItems.find(i => i.product_id === product.id)) return;
    setRequestItems([...requestItems, { product_id: product.id, quantity: 1, product }]);
    setProductSearch('');
  };

  const removeRequestItem = (productId: number) => {
    setRequestItems(requestItems.filter(i => i.product_id !== productId));
  };

  
  const filteredTransfers = transfers.filter(t => {
    if (activeTab === 'all') return true;
    
    
    if (isSuperAdmin && branchFilter === 'ALL') {
      if (activeTab === 'sender') {
        
        
        const isActionable = t.status === 'pending' || t.status === 'approved';
        if (!isActionable) return false;
        if (myBranchId && Number(t.destination_branch_id) === myBranchId) return false;
        return true;
      } else {
        
        
        return t.status === 'in_transit' || t.status === 'pending' || t.status === 'approved';
      }
    }

    
    if (!focusBranchId) return true; 

    if (activeTab === 'sender') {
      
      return Number(t.source_branch_id) === focusBranchId;
    } else {
      
      return Number(t.destination_branch_id) === focusBranchId;
    }
  });

  
  
  const senderActionCount = transfers.filter(t => {
    const isActionable = t.status === 'pending' || t.status === 'approved';
    if (!isActionable) return false;
    
    
    if (focusBranchId) return Number(t.source_branch_id) === focusBranchId;

    
    
    if (myBranchId && Number(t.destination_branch_id) === myBranchId) return false;
    return true;
  }).length;

  const receiverActionCount = transfers.filter(t => {
    const isActionable = t.status === 'in_transit';
    if (!isActionable) return false;
    
    
    if (focusBranchId) return Number(t.destination_branch_id) === focusBranchId;

    
    
    return true;
  }).length;

  

  const productSearchResults = productSearch ? products.filter(p => !p.is_service && p.name.toLowerCase().includes(productSearch.toLowerCase())).slice(0, 5) : [];

  return (
    <div className="p-6 mx-auto h-[calc(100vh-2rem)] flex flex-col">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-gray-900 tracking-tight uppercase">Branch Transfers</h1>
          <p className="text-sm font-bold text-gray-500 uppercase tracking-widest mt-1">Manage stock moving between branches</p>
        </div>
        
        <div className="flex gap-4">
          {isSuperAdmin && (
            <select 
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="bg-white border border-gray-200 text-sm font-bold rounded-xl px-4 py-2 uppercase tracking-wide focus:ring-2 focus:ring-indigo-500/20"
            >
              <option value="ALL">All Branches Network</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name.toUpperCase()}</option>
              ))}
            </select>
          )}
          
          <button 
            onClick={() => { setRequestItems([]); setTargetBranchId(''); setNotes(''); setRequestModalOpen(true); }}
            className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl active:scale-95"
          >
            <Plus className="w-4 h-4" />
            REQUEST STOCK
          </button>
        </div>
      </div>

      <div className="flex bg-gray-100 p-1 rounded-xl w-fit mb-6">
        <button 
          onClick={() => setActiveTab('sender')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'sender' ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Sending (To Fulfill)
          {senderActionCount > 0 && <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.5 rounded-full ring-2 ring-white shadow-sm">{senderActionCount}</span>}
        </button>
        <button 
          onClick={() => setActiveTab('receiver')}
          className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'receiver' ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
        >
          Receiving (My Requests)
          {receiverActionCount > 0 && <span className="bg-blue-600 text-white text-[9px] px-1.5 py-0.5 rounded-full ring-2 ring-white shadow-sm">{receiverActionCount}</span>}
        </button>
        {isSuperAdmin && (
           <button 
           onClick={() => setActiveTab('all')}
           className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'all' ? 'bg-white shadow-sm text-indigo-700 ring-1 ring-black/5' : 'text-gray-500 hover:text-gray-900'}`}
         >
           All Network Records
         </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex items-center justify-center p-12 text-gray-400 font-bold tracking-widest uppercase text-xs animate-pulse">
            Loading Transfers...
          </div>
        ) : filteredTransfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center flex-1 text-gray-400 p-12">
            <Package className="w-16 h-16 stroke-[1] mb-4 text-gray-300" />
            <p className="font-bold tracking-widest uppercase text-xs">No active transfers here.</p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
             <table className="w-full text-left">
               <thead className="bg-gray-50 border-b border-gray-100 sticky top-0 z-10">
                 <tr>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Reference</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Source Branch</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Destination</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Date</th>
                    <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                 {filteredTransfers.map(t => (
                   <tr key={t.id} onClick={() => { setSelectedTransfer(t); setViewModalOpen(true); }} className="hover:bg-indigo-50/40 cursor-pointer transition-colors group">
                     <td className="px-6 py-4">
                       <span className="font-black text-xs text-gray-900 group-hover:text-indigo-600 transition-colors uppercase tracking-widest">{t.reference_number}</span>
                     </td>
                     <td className="px-6 py-4 text-sm font-bold text-gray-600">
                       {t.source_branch?.name || `Branch #${t.source_branch_id}`}
                       {myBranchId && Number(myBranchId) === Number(t.source_branch_id) && <span className="ml-2 text-[9px] font-black text-red-500 uppercase tracking-widest bg-red-50 px-1.5 py-0.5 rounded">Sending</span>}
                     </td>
                     <td className="px-6 py-4 text-sm font-bold text-gray-600">
                       {t.destination_branch?.name || `Branch #${t.destination_branch_id}`}
                       {myBranchId && Number(myBranchId) === Number(t.destination_branch_id) && <span className="ml-2 text-[9px] font-black text-green-600 uppercase tracking-widest bg-green-50 px-1.5 py-0.5 rounded">Receiving</span>}
                     </td>
                     <td className="px-6 py-4 text-xs font-medium text-gray-500">
                       {new Date(t.created_at).toLocaleDateString()}
                     </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className={`px-2.5 py-1 text-[10px] font-black uppercase tracking-widest rounded-md w-fit ${getStatusColor(t.status)}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                          {isSuperAdmin && branchFilter === 'ALL' && (
                            <span className="text-[9px] font-bold text-gray-400 italic">
                              {t.status === 'pending' || t.status === 'approved' 
                                ? `Waiting for ${t.source_branch?.name || 'Sender'}` 
                                : t.status === 'in_transit' 
                                  ? `Waiting for ${t.destination_branch?.name || 'Receiver'}` 
                                  : ''}
                            </span>
                          )}
                        </div>
                      </td>
                   </tr>
                 ))}
               </tbody>
             </table>
          </div>
        )}
      </div>

      {}
      <Modal open={requestModalOpen} onClose={() => setRequestModalOpen(false)} title="REQUEST STOCK TRANSFER" maxWidth="max-w-2xl">
        <div className="space-y-6">
          <div className="bg-blue-50 text-blue-800 p-4 rounded-xl text-sm font-medium border border-blue-100 flex items-start gap-3">
             <Inbox className="w-5 h-5 shrink-0 mt-0.5" />
             <p>Create a request to pull inventory from another branch into your current branch ({user?.branch?.name}). Once approved and shipped by them, you can receive it.</p>
          </div>

          <FormField 
            label="Requesting From Branch"
            type="select"
            value={targetBranchId}
            onChange={setTargetBranchId}
            options={[
              { value: '', label: 'Select a Source Branch...' },
              ...branches.filter(b => b.id !== myBranchId).map(b => ({ value: b.id.toString(), label: b.name.toUpperCase() }))
            ]}
          />

          <FormField
            label="Internal Notes / Reason"
            type="textarea"
            value={notes}
            onChange={setNotes}
            placeholder="e.g. Urgent customer order..."
          />

          <div className="border border-gray-200 rounded-xl overflow-hidden">
             <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
               <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Requested Items</h3>
             </div>
             
             {}
             <div className="p-4 border-b border-gray-100 relative">
               <div className="relative">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                 <input
                   type="text"
                   placeholder="Search products to request..."
                   value={productSearch}
                   onChange={e => setProductSearch(e.target.value)}
                   className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                 />
               </div>
               
               {productSearchResults.length > 0 && (
                 <div className="absolute top-full left-4 right-4 mt-2 bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden z-20">
                   {productSearchResults.map(p => (
                     <div 
                       key={p.id} 
                       onClick={() => addRequestItem(p)}
                       className="p-3 hover:bg-indigo-50 cursor-pointer flex justify-between items-center transition-colors border-b border-gray-50 last:border-0"
                     >
                       <span className="text-sm font-bold text-gray-900">{p.name}</span>
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">ADD</span>
                     </div>
                   ))}
                 </div>
               )}
             </div>

             <div className="p-4 space-y-3 max-h-64 overflow-y-auto">
               {requestItems.length === 0 ? (
                 <p className="text-center text-xs text-gray-400 font-bold uppercase tracking-widest py-4">No items added</p>
               ) : (
                 requestItems.map(item => (
                   <div key={item.product_id} className="flex items-center justify-between gap-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
                     <span className="text-sm font-bold text-gray-900 flex-1">{item.product?.name}</span>
                     <div className="flex items-center gap-2">
                       <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">QTY</span>
                        <input 
                          type="number" 
                          min="1"
                          placeholder=""
                          value={item.quantity === 1 && !item._edited ? '' : item.quantity}
                          onChange={e => {
                            const val = e.target.value;
                            const qty = val === '' ? 1 : parseInt(val) || 1;
                            setRequestItems(requestItems.map(i => 
                              i.product_id === item.product_id ? { ...i, quantity: qty, _edited: true } : i
                            ));
                          }}
                          className="w-16 px-2 py-1 text-center font-bold text-sm border border-gray-300 rounded focus:border-indigo-500 outline-none" 
                        />
                       <button onClick={() => removeRequestItem(item.product_id)} className="p-1 px-2 text-red-500 hover:bg-red-50 rounded transition-colors font-black">X</button>
                     </div>
                   </div>
                 ))
               )}
             </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button onClick={() => setRequestModalOpen(false)} className="px-6 py-3 font-black text-xs uppercase tracking-widest text-gray-500 hover:text-gray-900 transition-colors">CANCEL</button>
            <button 
              onClick={submitRequest}
              disabled={requestItems.length === 0 || !targetBranchId}
              className={`px-8 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl transition-all ${
                requestItems.length === 0 || !targetBranchId 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none'
                : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95'
              }`}
            >
              SUBMIT REQUEST
            </button>
          </div>
        </div>
      </Modal>

      {}
      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)} title={`TRANSFER ${selectedTransfer?.reference_number}`} maxWidth="max-w-2xl">
        {selectedTransfer && (
          <div className="space-y-6">
            <div className="flex justify-between items-start pb-4 border-b border-gray-100">
              <div>
                <span className={`px-2 py-1 text-[10px] font-black uppercase tracking-widest rounded-md ${getStatusColor(selectedTransfer.status)}`}>
                  STATUS: {selectedTransfer.status.replace('_', ' ')}
                </span>
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-3">Date Requested: {new Date(selectedTransfer.created_at).toLocaleString()}</p>
                {selectedTransfer.notes && <p className="text-sm font-medium text-gray-700 mt-2 italic flex items-center gap-2"><div className="w-1 h-4 bg-gray-300 rounded" />{selectedTransfer.notes}</p>}
              </div>

              <div className="text-right">
                <p className="text-[10px] uppercase font-black tracking-widest text-red-500">FROM</p>
                <p className="text-sm font-black text-gray-900 mb-2">{selectedTransfer.source_branch?.name || `Branch ID ${selectedTransfer.source_branch_id}`}</p>
                
                <p className="text-[10px] uppercase font-black tracking-widest text-green-600">TO</p>
                <p className="text-sm font-black text-gray-900">{selectedTransfer.destination_branch?.name || `Branch ID ${selectedTransfer.destination_branch_id}`}</p>
              </div>
            </div>

            <div className="border border-gray-200 rounded-xl overflow-hidden">
               <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex justify-between">
                 <h3 className="text-xs font-black text-gray-900 uppercase tracking-widest">Requested Items</h3>
                 <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">QTY</span>
               </div>
               <div className="divide-y divide-gray-100">
                 {selectedTransfer.items.map(item => (
                   <div key={item.id} className="p-3 px-4 flex justify-between items-center bg-white hover:bg-gray-50 transition-colors">
                     <div>
                       <p className="text-sm font-bold text-gray-900">{item.product?.name || `Product ID ${item.product_id}`}</p>
                       <p className="text-[10px] font-medium text-gray-400">{item.product?.category?.name}</p>
                     </div>
                     <span className="text-lg font-black text-indigo-600">{item.quantity}</span>
                   </div>
                 ))}
               </div>
            </div>

            {}
            <div className="pt-4 border-t border-gray-100 flex flex-wrap gap-3 justify-end relative z-10">
              {/* actionBranch: for super_admin use the selected branch filter, for regular users use their own branch */}
              {(() => {
                const actionBranch = isSuperAdmin ? (focusBranchId || myBranchId) : myBranchId;
                const isSource = Number(actionBranch) === Number(selectedTransfer.source_branch_id);
                const isDest = Number(actionBranch) === Number(selectedTransfer.destination_branch_id);
                return (
                  <>
                    {/* Approve/Reject/Ship — SOURCE branch (has stock) */}
                    {(isSuperAdmin || isSource) && selectedTransfer.status === 'pending' && (
                      <>
                        <button onClick={() => handleUpdateStatus(selectedTransfer.id, 'rejected')} className="px-4 py-3 bg-red-50 text-red-600 font-black text-xs rounded-xl uppercase tracking-widest flex items-center gap-2 hover:bg-red-100 transition-colors cursor-pointer"><XCircle className="w-4 h-4"/> REJECT</button>
                        <button onClick={() => handleUpdateStatus(selectedTransfer.id, 'approved')} className="px-4 py-3 bg-blue-50 text-blue-700 font-black text-xs rounded-xl uppercase tracking-widest flex items-center gap-2 hover:bg-blue-100 transition-colors cursor-pointer"><CheckCircle className="w-4 h-4"/> APPROVE</button>
                      </>
                    )}

                    {/* Ship — source branch only after approved */}
                    {isSource && selectedTransfer.status === 'approved' && (
                      <button onClick={() => handleUpdateStatus(selectedTransfer.id, 'in_transit')} className="px-6 py-3 bg-purple-600 text-white font-black text-xs rounded-xl uppercase tracking-widest flex items-center gap-2 hover:bg-purple-500 transition-colors shadow-xl shadow-purple-200 cursor-pointer"><Truck className="w-4 h-4"/> SHIP INVENTORY</button>
                    )}

                    {/* Confirm Receipt — DESTINATION branch only */}
                    {isDest && selectedTransfer.status === 'in_transit' && (
                      <button onClick={() => handleUpdateStatus(selectedTransfer.id, 'completed')} className="px-6 py-3 bg-green-600 text-white font-black text-xs rounded-xl uppercase tracking-widest flex items-center gap-2 hover:bg-green-500 transition-colors shadow-xl shadow-green-200 cursor-pointer"><Inbox className="w-4 h-4"/> CONFIRM RECEIPT</button>
                    )}

                    {/* Cancel — source branch or requester can cancel */}
                    {isSource && selectedTransfer.status === 'pending' && (
                      <button onClick={() => handleUpdateStatus(selectedTransfer.id, 'cancelled')} className="px-4 py-3 bg-white border border-gray-200 text-gray-500 font-black text-xs rounded-xl uppercase tracking-widest hover:bg-gray-50 transition-colors cursor-pointer">CANCEL REQUEST</button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
