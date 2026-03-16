import { useState, useEffect, type FormEvent } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';

interface Supplier {
  id: number;
  name: string;
  contact_person: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [error, setError] = useState('');
  const { showToast } = useToast();

  
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  const fetchSuppliers = async () => {
    try {
      const res = await api.get('/api/suppliers');
      setSuppliers(res.data.suppliers || []);
    } catch {
      setError('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSuppliers(); }, []);

  const resetForm = () => {
    setName('');
    setContactPerson('');
    setPhone('');
    setEmail('');
    setAddress('');
    setNotes('');
    setError('');
  };

  const openCreate = () => {
    setEditing(null);
    resetForm();
    setModalOpen(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setName(supplier.name);
    setContactPerson(supplier.contact_person || '');
    setPhone(supplier.phone || '');
    setEmail(supplier.email || '');
    setAddress(supplier.address || '');
    setNotes(supplier.notes || '');
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const payload = { name, contact_person: contactPerson, phone, email, address, notes };
    try {
      if (editing) {
        await api.put(`/api/suppliers/${editing.id}`, payload);
      } else {
        await api.post('/api/suppliers', payload);
      }
      setModalOpen(false);
      showToast(editing ? 'Supplier updated successfully!' : 'Supplier created successfully!', 'success');
      fetchSuppliers();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Delete supplier "${supplier.name}"?`)) return;
    try {
      await api.delete(`/api/suppliers/${supplier.id}`);
      showToast('Supplier deleted successfully!', 'success');
      fetchSuppliers();
    } catch {
      showToast('Failed to delete supplier', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Suppliers</h1>
        <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
          Add Supplier
        </button>
      </div>

      {error && !modalOpen && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'contact_person', label: 'Contact Person' },
          { key: 'phone', label: 'Phone' },
          { key: 'email', label: 'Email' },
        ]}
        data={suppliers}
        loading={loading}
        onEdit={openEdit}
        onDelete={handleDelete}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Supplier' : 'New Supplier'}>
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <FormField label="Company Name" value={name} onChange={setName} required placeholder="Supplier name" />
          <FormField label="Contact Person" value={contactPerson} onChange={setContactPerson} placeholder="Contact person name" />
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Phone" value={phone} onChange={setPhone} placeholder="Phone number" />
            <FormField label="Email" value={email} onChange={setEmail} placeholder="Email address" />
          </div>
          <FormField label="Address" value={address} onChange={setAddress} placeholder="Full address" />
          <FormField label="Notes" value={notes} onChange={setNotes} placeholder="Additional notes" />
          <button type="submit" className="w-full mt-2 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
            {editing ? 'Update' : 'Create'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
