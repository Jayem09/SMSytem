import { useState, useEffect, useCallback, type FormEvent } from 'react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import RFIDField from '../components/RFIDField';
import { useAuth } from '../hooks/useAuth';
import { History, Edit2, Trash2, User, Phone, Mail, MapPin, ShoppingBag, CheckCircle, XCircle, Clock, CreditCard } from 'lucide-react';

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
  rfid_card_id?: string;
  loyaltyPoints?: number;
}

const getTier = (points: number) => {
  if (points >= 200) return { name: 'Gold', bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' };
  if (points >= 50) return { name: 'Silver', bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-300' };
  return { name: 'Bronze', bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' };
};

export default function Customers() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'purchasing' || user?.role === 'purchaser';
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
  const [rfidCardId, setRfidCardId] = useState('');
  const [rfidChecking, setRfidChecking] = useState(false);
  const [rfidDuplicateError, setRfidDuplicateError] = useState('');

  const fetchCustomers = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      const res = await api.get('/api/customers', { params });
      const data = res.data as { customers?: (Customer & { loyalty_points?: number })[] };
      const mapped = (data.customers || []).map(c => ({
        ...c,
        loyaltyPoints: c.loyalty_points,
      }));
      setCustomers(mapped);
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
      const res = await api.get('/api/orders', { params: { customer_id: String(customer.id) } });
      const data = res.data as { orders?: Order[] };
      setCustomerOrders(data.orders || []);
    } catch {
      alert('Failed to load purchase history');
    } finally {
      setHistoryLoading(false);
    }
  };

  const checkRfidDuplicate = async (rfid: string): Promise<boolean> => {
    if (!rfid || rfid.length < 8) {
      setRfidDuplicateError('');
      return false;
    }
    setRfidChecking(true);
    setRfidDuplicateError('');
    try {
      const res = await api.get(`/api/customers/rfid/${rfid}`);
      const data = res.data as { customer?: Customer };
      if (data?.customer) {
        if (editing && data.customer.id === editing.id) {
          setRfidDuplicateError('');
          setRfidChecking(false);
          return false;
        } else {
          setRfidDuplicateError(`Card already registered to ${data.customer.name}`);
          setRfidChecking(false);
          return true;
        }
      }
      setRfidChecking(false);
      return false;
    } catch {
      setRfidDuplicateError('');
      setRfidChecking(false);
      return false;
    }
  };

  const openCreate = () => {
    setEditing(null);
    setName(''); setEmail(''); setPhone(''); setAddress(''); setRfidCardId('');
    setError('');
    setRfidChecking(false);
    setRfidDuplicateError('');
    setModalOpen(true);
  };

  const openEdit = (c: Customer) => {
    setEditing(c);
    setName(c.name); setEmail(c.email); setPhone(c.phone); setAddress(c.address);
    setRfidCardId(c.rfid_card_id || '');
    setError('');
    setRfidChecking(false);
    setRfidDuplicateError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (rfidCardId && rfidCardId.length >= 8) {
      const isDuplicate = await checkRfidDuplicate(rfidCardId);
      if (isDuplicate) {
        setError('RFID card is already in use by another customer');
        return;
      }
    }
    const payload = { name, email, phone, address, rfid_card_id: rfidCardId };
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
    <div className="p-6 mx-auto">
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
          {
            key: 'name', label: 'Name', render: (c) => (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-50 rounded-lg text-gray-400 group-hover:text-gray-900 transition-colors">
                  <User className="w-4 h-4" />
                </div>
                <span className="font-semibold text-gray-900">{c.name}</span>
              </div>
            )
          },
          {
            key: 'email', label: 'Email', render: (c) => (
              <div className="flex items-center gap-2 text-gray-500">
                <Mail className="w-3.5 h-3.5" />
                <span>{c.email || '--'}</span>
              </div>
            )
          },
          {
            key: 'phone', label: 'Phone', render: (c) => (
              <div className="flex items-center gap-2 text-gray-500">
                <Phone className="w-3.5 h-3.5" />
                <span>{c.phone || '--'}</span>
              </div>
            )
          },
          {
            key: 'loyaltyPoints', label: 'Points', render: (c: Customer) => {
              const tier = getTier(c.loyaltyPoints || 0);
              return (
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${tier.bg} ${tier.text}`}>
                    {tier.name}
                  </span>
                  <span className={`text-xs font-medium ${(c.loyaltyPoints || 0) > 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                    {c.loyaltyPoints ? c.loyaltyPoints.toFixed(0) : 0} pts
                  </span>
                  {c.rfid_card_id && (
                    <span className="text-[10px] text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded" title="RFID Linked">⚡</span>
                  )}
                </div>
              );
            }
          },
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
            <div>
              <RFIDField value={rfidCardId} onChange={(val) => { setRfidCardId(val); checkRfidDuplicate(val); }} />
              {rfidChecking && (
                <p className="text-xs text-gray-400 ml-1 -mt-2">Checking card...</p>
              )}
              {rfidDuplicateError && (
                <p className="text-xs text-red-500 ml-1 -mt-2">{rfidDuplicateError}</p>
              )}
            </div>
          </div>
          <button type="submit" className="w-full mt-8 py-4 text-sm font-black text-white bg-gray-900 hover:bg-gray-800 rounded-2xl transition-all shadow-lg hover:shadow-xl active:scale-95 cursor-pointer uppercase tracking-widest">
            {editing ? 'Update Profile' : 'Save Customer'}
          </button>
        </form>
      </Modal>

      { }
      <Modal open={historyModalOpen} onClose={() => setHistoryModalOpen(false)} title="Purchase History" wide>
        <div className="p-6">
          {selectedCustomer && (
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100">
              <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center">
                <span className="text-lg font-bold text-indigo-600">
                  {selectedCustomer.name.split(' ').map(n => n[0]).join('').slice(0,2).toUpperCase()}
                </span>
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedCustomer.name}</h2>
                <p className="text-sm text-gray-500">{selectedCustomer.phone || selectedCustomer.email || 'No contact'}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-gray-400 uppercase tracking-wider">Total Spent</p>
                <p className="text-xl font-black text-gray-900">
                  ₱{customerOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="max-h-[50vh] overflow-y-auto -mx-2 px-2">
            {historyLoading ? (
              <div className="py-12 text-center text-gray-400 animate-pulse">Loading history...</div>
            ) : customerOrders.length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingBag className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500">No transactions yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customerOrders.map((order) => (
                  <div key={order.id} className="group relative p-4 rounded-2xl border border-gray-100 bg-white hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-50/50 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          order.status === 'completed' ? 'bg-emerald-100' :
                          order.status === 'cancelled' ? 'bg-rose-100' : 'bg-amber-100'
                        }`}>
                          {order.status === 'completed' ? (
                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                          ) : order.status === 'cancelled' ? (
                            <XCircle className="w-5 h-5 text-rose-600" />
                          ) : (
                            <Clock className="w-5 h-5 text-amber-600" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">Order #{order.id}</p>
                          <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${
                        order.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        order.status === 'cancelled' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                        'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {order.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <CreditCard className="w-3.5 h-3.5" />
                        {order.payment_method.toUpperCase()}
                      </div>
                      <p className="text-lg font-black text-gray-900">₱{order.total_amount.toLocaleString()}</p>
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
