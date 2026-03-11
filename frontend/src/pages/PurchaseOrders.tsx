import { useState, useEffect } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';

interface Supplier {
  id: number;
  name: string;
}

interface Product {
  id: number;
  name: string;
  price: number;
  cost_price: number;
  stock: number;
}

interface PurchaseOrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_cost: number;
  subtotal: number;
  product: Product;
}

interface PurchaseOrder {
  id: number;
  supplier_id: number;
  status: string;
  po_number: string;
  total_cost: number;
  order_date: string;
  received_date: string | null;
  notes: string;
  supplier: Supplier;
  user: { name: string };
  items: PurchaseOrderItem[];
}

// Removed ItemInput interface since it's moving to Inventory.tsx

export default function PurchaseOrders() {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null);
  const [error, setError] = useState('');
  
  // Custom Confirm / Receive Modal State
  const [confirmModal, setConfirmModal] = useState<{ 
    message: string; 
    onConfirm: (poNumber?: string) => void;
    requirePoNumber?: boolean;
  } | null>(null);
  const [receivePoNumber, setReceivePoNumber] = useState('');

  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/purchase-orders');
      setOrders(res.data.purchase_orders || []);
    } catch {
      setError('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const openView = (po: PurchaseOrder) => {
    setSelectedOrder(po);
    setViewModalOpen(true);
  };

  const handleReceive = async (po: PurchaseOrder) => {
    setReceivePoNumber('');
    setConfirmModal({
      message: `Mark order #${po.id} as received? This will add stock to all items. Please enter the supplier's Receipt/PO Number below.`,
      requirePoNumber: true,
      onConfirm: async (enteredPoNumber?: string) => {
        if (!enteredPoNumber) {
          alert("Supplier Receipt / PO Number is required to receive goods.");
          return;
        }
        try {
          await api.put(`/api/purchase-orders/${po.id}/receive`, { po_number: enteredPoNumber });
          fetchOrders();
          setViewModalOpen(false);
        } catch (err: unknown) {
          const axiosError = err as { response?: { data?: { error?: string } } };
          alert(axiosError.response?.data?.error || 'Failed to receive purchase order');
        }
      },
    });
  };

  const handleDelete = async (po: PurchaseOrder) => {
    setConfirmModal({
      message: `Delete PO #${po.id}? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await api.delete(`/api/purchase-orders/${po.id}`);
          fetchOrders();
        } catch (err: unknown) {
          const axiosError = err as { response?: { data?: { error?: string } } };
          setConfirmModal({
            message: axiosError.response?.data?.error || 'Failed to delete',
            onConfirm: () => setConfirmModal(null),
          });
        }
      },
    });
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      received: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  return (
    <>
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Purchase Orders</h1>
      </div>

      {error && <p className="text-red-600 text-sm mb-4">{error}</p>}

      {/* Purchase Orders Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">System ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Receipt/PO #</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Items</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Cost</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No purchase orders yet</td></tr>
            ) : (
              orders.map((po) => (
                <tr key={po.id} className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => openView(po)}>
                  <td className="px-4 py-3 font-medium text-gray-900">#{po.id}</td>
                  <td className="px-4 py-3 text-gray-700 font-mono">{po.po_number || <span className="text-gray-400 italic">Pending...</span>}</td>
                  <td className="px-4 py-3 text-gray-700">{po.supplier?.name || <span className="text-gray-400 italic">None</span>}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(po.order_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{po.items?.length || 0} items</td>
                  <td className="px-4 py-3 font-medium text-gray-900">₱{po.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  <td className="px-4 py-3">{statusBadge(po.status)}</td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {po.status === 'pending' && (
                        <>
                          <button onClick={() => handleReceive(po)} className="text-xs px-2 py-1 bg-green-50 text-green-700 rounded hover:bg-green-100 cursor-pointer">
                            Receive
                          </button>
                          <button onClick={() => handleDelete(po)} className="text-xs px-2 py-1 bg-red-50 text-red-700 rounded hover:bg-red-100 cursor-pointer">
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* View PO Details Modal */}
      <Modal open={viewModalOpen} onClose={() => setViewModalOpen(false)} title={`Purchase Order #${selectedOrder?.id}`} wide>
        {selectedOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-500">Supplier:</span>
                <span className="ml-2 font-medium">{selectedOrder.supplier?.name}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className="ml-2">{statusBadge(selectedOrder.status)}</span>
              </div>
              <div>
                <span className="text-gray-500">Order Date:</span>
                <span className="ml-2">{new Date(selectedOrder.order_date).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-gray-500">Created By:</span>
                <span className="ml-2">{selectedOrder.user?.name}</span>
              </div>
              {selectedOrder.received_date && (
                <div>
                  <span className="text-gray-500">Received:</span>
                  <span className="ml-2">{new Date(selectedOrder.received_date).toLocaleDateString()}</span>
                </div>
              )}
              {selectedOrder.notes && (
                <div className="col-span-2">
                  <span className="text-gray-500">Notes:</span>
                  <span className="ml-2">{selectedOrder.notes}</span>
                </div>
              )}
            </div>

            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Product</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Qty</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Unit Cost</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.items?.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{item.product?.name}</td>
                    <td className="px-3 py-2 text-right">{item.quantity}</td>
                    <td className="px-3 py-2 text-right">₱{item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                    <td className="px-3 py-2 text-right font-medium">₱{item.subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-3 py-2 text-right font-medium text-gray-700">Total:</td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">₱{selectedOrder.total_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                </tr>
              </tbody>
            </table>

            {selectedOrder.status === 'pending' && (
              <button onClick={() => handleReceive(selectedOrder)} className="w-full py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-500 rounded-md cursor-pointer">
                ✓ Mark as Received (Add Stock)
              </button>
            )}
          </div>
        )}
      </Modal>

      {/* Create PO Modal Removed (moved to Inventory) */}
    </div>

    {/* Custom Confirm Modal (replaces window.confirm for Tauri) */}
    {confirmModal && (
      <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
          <p className="text-gray-800 text-sm mb-4 leading-relaxed">{confirmModal.message}</p>
          
          {confirmModal.requirePoNumber && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Receipt / PO Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                autoFocus
                required
                value={receivePoNumber}
                onChange={(e) => setReceivePoNumber(e.target.value)}
                placeholder="e.g. INV-12345"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => setConfirmModal(null)}
              className="flex-1 border border-gray-300 text-gray-700 rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={confirmModal.requirePoNumber && !receivePoNumber.trim()}
              onClick={() => { 
                confirmModal.onConfirm(receivePoNumber); 
                setConfirmModal(null); 
              }}
              className="flex-1 bg-green-600 text-white rounded-lg py-2 text-sm hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    )}
  </>
  );
}
