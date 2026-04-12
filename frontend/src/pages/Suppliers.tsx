import { useState, useEffect, type FormEvent } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
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

interface Branch {
  id: number;
  name: string;
  code: string;
}

export default function Suppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [error, setError] = useState('');
  const { showToast } = useToast();
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'super_admin';

  // Form fields
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');

  // Branch link management (admin only)
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkSupplier, setLinkSupplier] = useState<Supplier | null>(null);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [linkedBranchIds, setLinkedBranchIds] = useState<Set<number>>(new Set());
  const [linkLoading, setLinkLoading] = useState(false);

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

  // Branch link management
  const openLinkModal = async (supplier: Supplier) => {
    setLinkSupplier(supplier);
    setLinkLoading(true);
    setLinkModalOpen(true);
    try {
      const [branchesRes, linkedRes] = await Promise.all([
        api.get('/api/branches'),
        api.get(`/api/suppliers/${supplier.id}/branches`),
      ]);
      setAllBranches(branchesRes.data.branches || []);
      const ids = new Set<number>((linkedRes.data.branches || []).map((b: Branch) => b.id));
      setLinkedBranchIds(ids);
    } catch {
      showToast('Failed to load branch data', 'error');
      setLinkModalOpen(false);
    } finally {
      setLinkLoading(false);
    }
  };

  const toggleBranchLink = async (branchId: number) => {
    if (!linkSupplier) return;
    const isLinked = linkedBranchIds.has(branchId);
    try {
      if (isLinked) {
        await api.delete(`/api/suppliers/${linkSupplier.id}/branches/${branchId}`);
        setLinkedBranchIds(prev => {
          const next = new Set(prev);
          next.delete(branchId);
          return next;
        });
      } else {
        await api.post(`/api/suppliers/${linkSupplier.id}/branches/${branchId}`);
        setLinkedBranchIds(prev => new Set(prev).add(branchId));
      }
    } catch {
      showToast('Failed to update branch link', 'error');
    }
  };

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'contact_person', label: 'Contact Person' },
    { key: 'phone', label: 'Phone' },
    { key: 'email', label: 'Email' },
    ...(isSuperAdmin ? [{
      key: 'branches',
      label: 'Branches',
      render: (item: Supplier) => (
        <button
          onClick={() => openLinkModal(item)}
          className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Manage
        </button>
      ),
    }] : []),
  ];

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
        columns={columns}
        data={suppliers}
        loading={loading}
        onEdit={openEdit}
        onDelete={isSuperAdmin ? handleDelete : undefined}
      />

      {/* Create/Edit Modal */}
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

      {/* Branch Link Management Modal (Admin only) */}
      <Modal open={linkModalOpen} onClose={() => setLinkModalOpen(false)} title={`Manage Branches — ${linkSupplier?.name || ''}`}>
        {linkLoading ? (
          <div className="py-8 text-center text-gray-500">Loading branches...</div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-gray-500 mb-3">Toggle which branches can see this supplier.</p>
            {allBranches.map(branch => (
              <label key={branch.id} className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={linkedBranchIds.has(branch.id)}
                  onChange={() => toggleBranchLink(branch.id)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">{branch.name}</span>
                  <span className="text-xs text-gray-400 ml-2 font-mono">{branch.code}</span>
                </div>
              </label>
            ))}
            {allBranches.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No branches found</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}