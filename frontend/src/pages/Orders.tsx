import { useState, useEffect } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { Printer, Eye, Trash2, CheckCircle2 } from 'lucide-react';
import { printReceipt } from '../components/Receipt';
import { printDeliveryReceipt } from '../components/DeliveryReceipt';
import { getIsOfflineMode } from '../context/AuthContext';
import offlineStorage, { type LocalOrder } from '../services/offlineStorage';

interface Customer { id: number; name: string; }
interface Product { id: number; name: string; price: number; branch_stock: number; stock?: number; is_service?: boolean; }
interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}
interface Order {
  id: number;
  customer_id?: number | null;
  guest_name?: string;
  guest_phone?: string;
  total_amount: number;
  discount_amount: number;
  status: string;
  payment_method: string;
  receipt_type: 'SI' | 'DR';
  tin: string;
  business_address: string;
  withholding_tax_rate: number;
  created_at: string;
  customer?: Customer;
  items?: OrderItem[];
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function Orders() {
  const { user, isAuthenticated } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'purchasing' || user?.role === 'purchaser';
  const canCompletePending = user?.role !== 'super_admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Fetch orders when component mounts or when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      const fetch = async () => {
        // If offline, load from localStorage cache (only unsynced orders!)
        if (getIsOfflineMode()) {
          const allCached = offlineStorage.getOrders();
          // Only show unsynced orders when offline
          const cached = allCached.filter(o => !o.synced);
          console.log('[Orders] Unsynced offline orders:', cached);
          
          // Transform to match Order interface (totalAmount -> total_amount)
          const transformed = (cached || []).map((o: LocalOrder) => {
            // Parse items and add computed fields
            let items: any[] = [];
            try {
              items = o.items ? JSON.parse(o.items) : [];
              // Add computed fields for display
              items = items.map((item, idx) => ({
                ...item,
                id: item.id || idx,
                product: { name: item.product_name || `Product #${item.product_id}` },
                unit_price: item.unit_price || 0,
                subtotal: (item.quantity || 0) * (item.unit_price || 0),
              }));
            } catch (e) {
              console.error('[Orders] Failed to parse items:', e);
            }
            
            return {
              ...o,
              id: o.id || Date.now(),
              total_amount: o.totalAmount || 0,
              discount_amount: o.discountAmount || 0,
              created_at: o.createdAt || new Date().toISOString(),
              payment_method: o.paymentMethod || 'cash',
              receipt_type: o.receiptType || 'SI',
              tin: o.tin || '',
              business_address: o.businessAddress || '',
              withholding_tax_rate: o.withholdingTaxRate || 0,
              customer: o.customerName ? { name: o.customerName, phone: o.customerPhone } : null,
              guest_name: o.guestName || '',
              guest_phone: o.guestPhone || '',
              service_advisor_name: o.serviceAdvisorName || '',
              reward_id: o.rewardId || null,
              reward_points: o.rewardPoints || 0,
              items,
            };
          });
          console.log('[Orders] Transformed orders:', transformed);
          setOrders(transformed);
          setLoading(false);
          return;
        }
        
        setLoading(true);
        console.log('[Orders] Fetching orders from API...');
        try {
          const res = await api.get('/api/orders');
          console.log('[Orders] API response:', res.data);
          console.log('[Orders] Orders array:', res.data.orders);
          setOrders(res.data.orders || []);
        } catch (err: unknown) {
          console.error('[Orders] Failed to fetch orders:', err);
          const axiosError = err as { response?: { data?: unknown } };
          console.error('[Orders] Response data:', axiosError.response?.data);
        } finally {
          setLoading(false);
        }
      };
      fetch();
    }
  }, [isAuthenticated]);

  // Listen for sync completion to refetch orders
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('[Orders] Sync completed, refetching...');
      fetchOrders();
    };
    window.addEventListener('sync_completed', handleSyncComplete);
    return () => window.removeEventListener('sync_completed', handleSyncComplete);
  }, [isAuthenticated]);

  // Fetch orders function for refresh after delete/complete
  const fetchOrders = async () => {
    if (getIsOfflineMode()) {
      const allCached = offlineStorage.getOrders();
      const cached = allCached.filter(o => !o.synced);
      const transformed = (cached || []).map((o: LocalOrder) => {
        let items: any[] = [];
        try {
          items = o.items ? JSON.parse(o.items) : [];
          items = items.map((item, idx) => ({
            ...item,
            id: item.id || idx,
            product: { name: item.product_name || `Product #${item.product_id}` },
            unit_price: item.unit_price || 0,
            subtotal: (item.quantity || 0) * (item.unit_price || 0),
          }));
        } catch (e) {
          console.error('[Orders] Failed to parse items:', e);
        }
        return {
          ...o,
          id: o.id || Date.now(),
          total_amount: o.totalAmount || 0,
          discount_amount: o.discountAmount || 0,
          created_at: o.createdAt || new Date().toISOString(),
          payment_method: o.paymentMethod || 'cash',
          receipt_type: o.receiptType || 'SI',
          tin: o.tin || '',
          business_address: o.businessAddress || '',
          withholding_tax_rate: o.withholdingTaxRate || 0,
          customer: o.customerName ? { name: o.customerName, phone: o.customerPhone } : null,
          guest_name: o.guestName || '',
          guest_phone: o.guestPhone || '',
          service_advisor_name: o.serviceAdvisorName || '',
          reward_id: o.rewardId || null,
          reward_points: o.rewardPoints || 0,
          items,
        };
      });
      setOrders(transformed);
      return;
    }
    setLoading(true);
    console.log('[Orders] Fetching orders from API...');
    try {
      const res = await api.get('/api/orders');
      console.log('[Orders] API response:', res.data);
      console.log('[Orders] Orders array:', res.data.orders);
      setOrders(res.data.orders || []);
    } catch (err: unknown) {
      console.error('[Orders] Failed to fetch orders:', err);
      const axiosError = err as { response?: { data?: unknown } };
      console.error('[Orders] Response data:', axiosError.response?.data);
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (order: Order) => {
    if (!confirm(`Delete order #${order.id}?`)) return;
    try {
      await api.delete(`/api/orders/${order.id}`);
      fetchOrders();
    } catch {
      alert('Failed to delete order');
    }
  };

  const handleCompletePending = async (order: Order) => {
    if (!confirm(`Complete Pending Order #${order.id}? This will process the payment and deduct stock.`)) return;
    try {
      await api.patch(`/api/orders/${order.id}/status`, { status: 'completed' });
      fetchOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { details?: string } }; message?: string };
      alert(`Failed to complete order: ${e.response?.data?.details || e.message}`);
    }
  };

  const handlePrint = async (order: Order) => {
    console.log('[Orders] Printing order:', order);
    
    // Ensure items have required fields for receipt
    const orderForReceipt = {
      ...order,
      items: (order.items || []).map((item: any) => ({
        ...item,
        unit_price: item.unit_price ?? item.price ?? 0,
        subtotal: item.subtotal ?? ((item.quantity || 0) * (item.unit_price ?? item.price ?? 0)),
        product: item.product || { name: `Product #${item.product_id}` },
      })),
    };
    
    if ((order as any).receipt_type === 'SI') {
      await printReceipt(orderForReceipt, (order as any).tin || '', (order as any).business_address || '', (order as any).withholding_tax_rate || 0);
    } else {
      await printDeliveryReceipt(orderForReceipt, (order as any).tin || '', (order as any).business_address || '', (order as any).withholding_tax_rate || 0);
    }
  };

  return (
    <div className="p-6 mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Orders</h1>
          <p className="text-gray-500 mt-1">Manage sales, payments, and generate customer receipts.</p>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'id', label: 'Order #', render: (o) => `#${o?.id || 'N/A'}` },
          { key: 'customer', label: 'Customer', render: (o) => o?.customer?.name || o?.guest_name || 'Walk-In' },
          { key: 'total_amount', label: 'Total', render: (o) => `P ${(o?.total_amount ?? 0).toLocaleString()}` },
          { key: 'status', label: 'Status', render: (o) => (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[o?.status] || 'bg-gray-100 text-gray-800'}`}>
              {o?.status || 'unknown'}
            </span>
          )},
          { key: 'payment_method', label: 'Payment' },
          { key: 'created_at', label: 'Date', render: (o) => o?.created_at ? new Date(o.created_at).toLocaleDateString() : 'N/A' },
        ]}
        data={orders}
        loading={loading}
        actions={(order) => (
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => { setSelectedOrder(order); setItemsModalOpen(true); }}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePrint(order)}
              className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              title={`Print ${order.receipt_type === 'SI' ? 'Sales Invoice' : 'Delivery Receipt'}`}
            >
              <Printer className="w-4 h-4" />
            </button>

            {order.status === 'pending' && canCompletePending && (
              <button
                onClick={() => handleCompletePending(order)}
                className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                title="Complete & Deduct Stock"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}

            {isAdmin && (
              <button 
                onClick={() => handleDelete(order)} 
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="Delete Order"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {}
      <Modal open={itemsModalOpen} onClose={() => setItemsModalOpen(false)} title={`Order #${selectedOrder?.id || ''} Details`} maxWidth="max-w-3xl">
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</p>
                <p className="text-sm font-bold text-gray-900">{selectedOrder.customer?.name || selectedOrder.guest_name || 'Walk-In'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</p>
                <p className="text-sm font-bold text-gray-900">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Type</p>
                <p className="text-sm font-bold text-gray-900">{selectedOrder.receipt_type === 'SI' ? 'Sales Invoice' : 'Delivery Receipt'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest ${
                  selectedOrder.status === 'completed' ? 'bg-green-100 text-green-700' : 
                  selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-700'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>
            </div>

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left">
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Unit Price</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedOrder.items?.map((item: any, idx: number) => (
                    <tr key={item?.id || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4 text-gray-900 font-bold">{item?.product?.name || item?.product_name || `Product #${item?.product_id || 'N/A'}`}</td>
                      <td className="py-4 px-4 text-gray-600 text-center font-medium">{item?.quantity || 0}</td>
                      <td className="py-4 px-4 text-gray-600 text-right">₱{(item?.unit_price ?? 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-gray-900 font-black text-right">₱{(item?.subtotal ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold">
                    ₱{selectedOrder.items?.reduce((sum: number, item: any) => sum + (item?.subtotal ?? 0), 0).toLocaleString()}
                  </span>
                </div>
                {((selectedOrder as any)?.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span className="font-medium">Discount</span>
                    <span className="font-bold">-₱{((selectedOrder as any)?.discount_amount ?? 0).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Paid</span>
                  <span className="text-2xl font-black text-gray-900 tracking-tighter">₱{((selectedOrder as any)?.total_amount ?? 0).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100 flex justify-end">
               <button
                 onClick={() => handlePrint(selectedOrder)}
                 className="px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2 cursor-pointer"
               >
                 <Printer className="w-4 h-4" />
                 Print Receipt
               </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
