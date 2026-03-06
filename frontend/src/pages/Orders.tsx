import { useState, useEffect, type FormEvent } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { Printer, Eye, Trash2, ChevronUp} from 'lucide-react';

interface Customer { id: number; name: string; }
interface Product { id: number; name: string; price: number; stock: number; }
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
  customer_id: number;
  total_amount: number;
  status: string;
  payment_method: string;
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
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountType, setDiscountType] = useState('fixed'); // 'fixed' or 'percentage'
  const [taxAmount, setTaxAmount] = useState('0');
  const [isTaxInclusive, setIsTaxInclusive] = useState(false);
  const [items, setItems] = useState<{ product_id: string; quantity: string }[]>([{ product_id: '', quantity: '1' }]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/orders');
      setOrders(res.data.orders);
    } catch (err: unknown) {
      console.error('Failed to fetch orders', err);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const fetchMeta = async () => {
    const [cRes, pRes] = await Promise.all([
      api.get('/api/customers'),
      api.get('/api/products'),
    ]);
    setCustomers(cRes.data.customers || []);
    setProducts(pRes.data.products || []);
  };

  useEffect(() => { fetchOrders(); fetchMeta(); }, []);

  const openCreate = () => {
    setCustomerId('');
    setPaymentMethod('cash');
    setDiscountAmount('0');
    setDiscountType('fixed');
    setTaxAmount('0');
    setIsTaxInclusive(false);
    setItems([{ product_id: '', quantity: '1' }]);
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', quantity: '1' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: string) => {
    const updated = [...items];
    (updated[i] as unknown as Record<string, string>)[field] = val;
    setItems(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      customer_id: parseInt(customerId),
      payment_method: paymentMethod,
      discount_amount: parseFloat(discountAmount) || 0,
      discount_type: discountType,
      tax_amount: parseFloat(taxAmount) || 0,
      is_tax_inclusive: isTaxInclusive,
      items: items.map((it) => ({
        product_id: parseInt(it.product_id),
        quantity: parseInt(it.quantity),
      })),
    };
    try {
      await api.post('/api/orders', payload);
      setModalOpen(false);
      fetchOrders();
      fetchMeta();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Failed to create order');
    }
  };

  const updateStatus = async (order: Order, status: string) => {
    try {
      await api.put(`/api/orders/${order.id}/status`, { status });
      fetchOrders();
    } catch {
      alert('Failed to update status');
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

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Orders</h1>
          <p className="text-gray-500 mt-1">Manage sales, payments, and generate customer receipts.</p>
        </div>
        <button 
          onClick={openCreate} 
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer"
        >

          NEW TRANSACTION
        </button>
      </div>

      {error && !modalOpen && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <DataTable
        columns={[
          { key: 'id', label: 'Order #', render: (o) => `#${o.id}` },
          { key: 'customer', label: 'Customer', render: (o) => o.customer?.name || '--' },
          { key: 'total_amount', label: 'Total', render: (o) => `P ${o.total_amount.toLocaleString()}` },
          { key: 'status', label: 'Status', render: (o) => (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[o.status] || 'bg-gray-100 text-gray-800'}`}>
              {o.status}
            </span>
          )},
          { key: 'payment_method', label: 'Payment' },
          { key: 'created_at', label: 'Date', render: (o) => new Date(o.created_at).toLocaleDateString() },
        ]}
        data={orders}
        loading={loading}
        actions={(order) => (
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              title="View Details"
            >
              {expandedId === order.id ? <ChevronUp className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { setSelectedOrder(order); setInvoiceModalOpen(true); }}
              className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              title="Print Invoice"
            >
              <Printer className="w-4 h-4" />
            </button>
            {isAdmin && order.status !== 'completed' && order.status !== 'cancelled' && (
              <select
                value=""
                onChange={(e) => { if (e.target.value) updateStatus(order, e.target.value); }}
                className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-600"
              >
                <option value="">Status</option>
                <option value="confirmed">Confirmed</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
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

      {/* Expanded order items */}
      {expandedId && (
        <div className="mt-2 border border-gray-200 rounded-lg p-4 bg-white">
          <h3 className="text-sm font-medium text-gray-900 mb-2">Order #{expandedId} - Items</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 uppercase">
                <th className="pb-2">Product</th>
                <th className="pb-2">Qty</th>
                <th className="pb-2">Unit Price</th>
                <th className="pb-2">Subtotal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orders.find((o) => o.id === expandedId)?.items?.map((item) => (
                <tr key={item.id}>
                  <td className="py-2 text-gray-900">{item.product?.name || `Product #${item.product_id}`}</td>
                  <td className="py-2 text-gray-600">{item.quantity}</td>
                  <td className="py-2 text-gray-600">P {item.unit_price.toLocaleString()}</td>
                  <td className="py-2 text-gray-900 font-medium">P {item.subtotal.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create order modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New Order">
        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <FormField
            label="Customer"
            type="select"
            value={customerId}
            onChange={setCustomerId}
            required
            options={customers.map((c) => ({ value: c.id, label: c.name }))}
          />
          <FormField
            label="Payment Method"
            type="select"
            value={paymentMethod}
            onChange={setPaymentMethod}
            required
            options={[
              { value: 'cash', label: 'Cash' },
              { value: 'card', label: 'Card' },
              { value: 'gcash', label: 'GCash' },
              { value: 'bank_transfer', label: 'Bank Transfer' },
            ]}
          />

          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="flex gap-1 items-end">
              <div className="flex-1">
                <FormField label="Discount" type="number" value={discountAmount} onChange={setDiscountAmount} min={0} step="0.01" />
              </div>
              <select
                className="mb-3 px-2 py-1.5 border border-gray-200 rounded text-sm bg-gray-50 h-[38px]"
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value)}
              >
                <option value="fixed">Fixed</option>
                <option value="percentage">%</option>
              </select>
            </div>
            <div className="flex flex-col">
              <FormField label="Tax Amount" type="number" value={taxAmount} onChange={setTaxAmount} min={0} step="0.01" />
              <label className="flex items-center gap-2 text-xs text-gray-500 mt-[-8px]">
                <input type="checkbox" checked={isTaxInclusive} onChange={(e) => setIsTaxInclusive(e.target.checked)} />
                Tax Inclusive
              </label>
            </div>
          </div>

          <div className="mt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Items</label>
              <button type="button" onClick={addItem} className="text-xs text-indigo-600 hover:text-indigo-800 cursor-pointer">
                + Add item
              </button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="flex gap-2 mb-2 items-end">
                <div className="flex-1">
                  <select
                    value={item.product_id}
                    onChange={(e) => updateItem(i, 'product_id', e.target.value)}
                    required
                    className="w-full px-2 py-1.5 border border-gray-200 rounded text-sm"
                  >
                    <option value="">Product</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>
                    ))}
                  </select>
                </div>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', e.target.value)}
                  min={1}
                  required
                  className="w-20 px-2 py-1.5 border border-gray-200 rounded text-sm"
                  placeholder="Qty"
                />
                {items.length > 1 && (
                  <button type="button" onClick={() => removeItem(i)} className="text-red-500 text-xs cursor-pointer pb-1">
                    x
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex justify-between text-sm text-gray-500 mb-1">
              <span>Subtotal</span>
              <span>P {
                items.reduce((acc, it) => {
                  const p = products.find(prod => String(prod.id) === it.product_id);
                  return acc + (p?.price || 0) * (parseInt(it.quantity) || 0);
                }, 0).toLocaleString()
              }</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900">
              <span>Final Total</span>
              <span>P {
                (() => {
                  const sub = items.reduce((acc, it) => {
                    const p = products.find(prod => String(prod.id) === it.product_id);
                    return acc + (p?.price || 0) * (parseInt(it.quantity) || 0);
                  }, 0);
                  let total = sub;
                  const disc = parseFloat(discountAmount) || 0;
                  if (discountType === 'percentage') {
                    total -= sub * (disc / 100);
                  } else {
                    total -= disc;
                  }
                  if (!isTaxInclusive) {
                    total += parseFloat(taxAmount) || 0;
                  }
                  return Math.max(0, total).toLocaleString();
                })()
              }</span>
            </div>
          </div>

          <button type="submit" className="w-full mt-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
            Create Order
          </button>
        </form>
      </Modal>

      {/* Invoice Modal */}
      <Modal open={invoiceModalOpen} onClose={() => setInvoiceModalOpen(false)} title="Print Preview">
        {selectedOrder && (
          <div className="p-4 overflow-y-auto max-h-[80vh]">
            <div id="printable-invoice" className="bg-white p-8 border border-gray-100 rounded-xl shadow-sm font-sans text-gray-900">
              <div className="flex justify-between items-start mb-8 pb-8 border-b border-gray-100">
                <div>
                  <h1 className="text-3xl font-black text-gray-900 tracking-tighter mb-1">SM TYRE DEPOT</h1>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Premium Auto Care & Tyres</p>
                </div>
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">INVOICE</h2>
                  <p className="text-sm font-medium text-gray-500">#{selectedOrder.id}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-8 mb-12">
                <div>
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Billed To</h3>
                  <p className="font-bold text-gray-900">{selectedOrder.customer?.name}</p>
                  <p className="text-sm text-gray-600">Customer ID: {selectedOrder.customer_id}</p>
                </div>
                <div className="text-right">
                  <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Issued On</h3>
                  <p className="font-bold text-gray-900">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
                  <p className="text-sm text-gray-600">Payment: {selectedOrder.payment_method.toUpperCase()}</p>
                </div>
              </div>

              <table className="w-full mb-8">
                <thead>
                  <tr className="text-left border-b-2 border-gray-900">
                    <th className="py-4 text-xs font-black uppercase tracking-widest">Description</th>
                    <th className="py-4 text-xs font-black uppercase tracking-widest text-center">Qty</th>
                    <th className="py-4 text-xs font-black uppercase tracking-widest text-right">Price</th>
                    <th className="py-4 text-xs font-black uppercase tracking-widest text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedOrder.items?.map((item) => (
                    <tr key={item.id}>
                      <td className="py-4 font-bold text-gray-900">{item.product?.name}</td>
                      <td className="py-4 text-center font-medium">{item.quantity}</td>
                      <td className="py-4 text-right text-gray-600">₱{item.unit_price.toLocaleString()}</td>
                      <td className="py-4 text-right font-bold">₱{item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end pt-8 border-t-2 border-gray-900">
                <div className="w-64 space-y-3">
                  <div className="flex justify-between text-sm text-gray-500 font-medium">
                    <span>Subtotal</span>
                    <span>₱{selectedOrder.items?.reduce((a,c) => a + c.subtotal, 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-lg font-black text-gray-900 pt-3 border-t border-gray-100">
                    <span className="tracking-tighter uppercase">Total Amount</span>
                    <span>₱{selectedOrder.total_amount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="mt-20 pt-8 border-t border-gray-100 text-center">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest leading-relaxed">
                  Thank you for your business!<br/>
                  Please keep this receipt for your records.
                </p>
              </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * { visibility: hidden; }
                #printable-invoice, #printable-invoice * { visibility: visible; }
                #printable-invoice { 
                  position: absolute; 
                  left: 0; 
                  top: 0; 
                  width: 100%; 
                  border: none !important;
                  box-shadow: none !important;
                }
              }
            `}} />

            <button 
              onClick={() => window.print()} 
              className="mt-6 w-full py-4 text-sm font-black text-white bg-gray-900 hover:bg-gray-800 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 flex items-center justify-center gap-2"
            >
              <Printer className="w-4 h-4" />
              PRINT RECEIPT
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
