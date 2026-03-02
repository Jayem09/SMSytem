import { useState, useEffect, type FormEvent } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { useAuth } from '../context/AuthContext';

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
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Form
  const [customerId, setCustomerId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [items, setItems] = useState<{ product_id: string; quantity: string }[]>([{ product_id: '', quantity: '1' }]);

  const fetchOrders = async () => {
    try {
      const res = await api.get('/api/orders');
      setOrders(res.data.orders || []);
    } catch {
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
    setItems([{ product_id: '', quantity: '1' }]);
    setError('');
    setModalOpen(true);
  };

  const addItem = () => setItems([...items, { product_id: '', quantity: '1' }]);
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, val: string) => {
    const updated = [...items];
    (updated[i] as any)[field] = val;
    setItems(updated);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = {
      customer_id: parseInt(customerId),
      payment_method: paymentMethod,
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
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create order');
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
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Orders</h1>
        <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
          New Order
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
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => setExpandedId(expandedId === order.id ? null : order.id)}
              className="text-gray-500 hover:text-gray-700 text-xs font-medium cursor-pointer"
            >
              {expandedId === order.id ? 'Hide' : 'View'}
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
              <button onClick={() => handleDelete(order)} className="text-red-600 hover:text-red-800 text-xs font-medium cursor-pointer">
                Delete
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

          <button type="submit" className="w-full mt-3 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
            Create Order
          </button>
        </form>
      </Modal>
    </div>
  );
}
