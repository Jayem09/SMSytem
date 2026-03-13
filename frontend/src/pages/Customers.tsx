import { useState, useEffect, useCallback, type FormEvent } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';
import { History, Edit2, Trash2, User, Phone, Mail, MapPin } from 'lucide-react';

interface Order {
  id: number;
  total_amount: number;
  status: string;
  created_at: string;
  payment_method: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
}

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [historyModalOpen, setHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerOrders, setCustomerOrders] = useState<Order[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [error, setError] = useState('');

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await api.get('/api/customers', { params });
      setCustomers(res.data.customers || []);
    } catch {
      setError('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);
  useEffect(() => { const t = setTimeout(fetchCustomers, 300); return () => clearTimeout(t); }, [fetchCustomers]);

  const fetchHistory = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setHistoryLoading(true);
    setHistoryModalOpen(true);
    try {
      const res = await api.get('/api/orders', { params: { customer_id: customer.id } });
      setCustomerOrders(res.data.orders || []);
    } catch {
      alert('Failed to load purchase history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName(''); setEmail(''); setPhone(''); setAddress('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name); setEmail(c.email); setPhone(c.phone); setAddress(c.address);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { name, email, phone, address };
    try {
      if (editing) {
        await api.put(`/api/customers/${editing.id}`, payload);
      } else {
        await api.post('/api/customers', payload);
      }
      setModalOpen(false);
      fetchCustomers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Delete customer "${c.name}"?`)) return;
    try {
      await api.delete(`/api/customers/${c.id}`);
      fetchCustomers();
    } catch {
      alert('Failed to delete customer');
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Customers</h1>
          <p className="text-gray-500 mt-1">Manage client profiles and view transaction history.</p>
        </div>
        <button 
          onClick={openCreate} 
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-md transition-all shadow-sm hover:shadow-md active:scale-95 cursor-pointer"
        >
          Add Customer
        </button>
      </div>

      {error && !modalOpen && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <DataTable
        columns={[
          { key: 'name', label: 'Name', render: (c) => (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-gray-900 transition-colors">
                <User className="w-4 h-4" />
              </div>
              <span className="font-semibold text-gray-900">{c.name}</span>
            </div>
          )},
          { key: 'email', label: 'Email', render: (c) => (
            <div className="flex items-center gap-2 text-gray-500">
              <Mail className="w-3.5 h-3.5" />
              <span>{c.email || '--'}</span>
            </div>
          )},
          { key: 'phone', label: 'Phone', render: (c) => (
            <div className="flex items-center gap-2 text-gray-500">
              <Phone className="w-3.5 h-3.5" />
              <span>{c.phone || '--'}</span>
            </div>
          )},
        ]}
        data={customers}
        loading={loading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, or phone..."
        actions={(c) => (
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => fetchHistory(c)}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer"
              title="Purchase History"
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={() => openEdit(c)}
              className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-colors cursor-pointer"
              title="Edit Profile"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {isAdmin && (
              <button
                onClick={() => handleDelete(c)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="Delete Customer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Customer' : 'New Customer'}>
        <form onSubmit={handleSubmit} className="p-1">
          {error && <p className="text-red-600 text-sm mb-4 bg-red-50 p-3 rounded-xl border border-red-100">{error}</p>}
          <div className="space-y-4">
            <FormField label="Full Name" value={name} onChange={setName} required placeholder="e.g. Juan Dela Cruz" icon={<User className="w-4 h-4" />} />
            <FormField label="Email Address" type="email" value={email} onChange={setEmail} placeholder="juan@example.com" icon={<Mail className="w-4 h-4" />} />
            <FormField label="Phone Number" value={phone} onChange={setPhone} placeholder="09XX XXX XXXX" icon={<Phone className="w-4 h-4" />} />
            <FormField label="Home Address" type="textarea" value={address} onChange={setAddress} placeholder="Street, City, Province" icon={<MapPin className="w-4 h-4" />} />
          </div>
          <button type="submit" className="w-full mt-8 py-4 text-sm font-black text-white bg-gray-900 hover:bg-gray-800 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 cursor-pointer uppercase tracking-widest">
            {editing ? 'Update Profile' : 'Save Customer'}
          </button>
        </form>
      </Modal>

      {}
      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title="Purchase History">
        <div className="p-4">
          <div className="mb-6 pb-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-gray-900">{selectedCustomer?.name}</h2>
            <p className="text-sm text-gray-500">{selectedCustomer?.email || 'No email provided'}</p>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {historyLoading ? (
              <div className="py-12 text-center text-gray-400 animate-pulse">Loading history...</div>
            ) : customerOrders.length === 0 ? (
              <div className="py-12 text-center text-gray-400">No transactions found for this customer.</div>
            ) : (
              <div className="space-y-3">
                {customerOrders.map((order) => (
                  <div key={order.id} className="p-4 border border-gray-100 rounded-2xl bg-gray-50 hover:bg-white hover:shadow-md transition-all group">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-black text-gray-400 uppercase tracking-widest">Order #{order.id}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
                        order.status === 'completed' ? 'bg-emerald-100 text-emerald-700' :
                        order.status === 'cancelled' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex justify-between items-end">
                      <div>
                        <p className="text-sm font-bold text-gray-900">₱{order.total_amount.toLocaleString()}</p>
                        <p className="text-[10px] text-gray-500 font-medium">{new Date(order.created_at).toLocaleDateString()} via {order.payment_method.toUpperCase()}</p>
                      </div>
                      <a href="/orders" className="text-[10px] font-black text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">View Details →</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
