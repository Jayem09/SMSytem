import { useState, useEffect, type FormEvent } from 'react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

interface Brand {
  id: number;
  name: string;
}

export default function Brands() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'purchasing' || user?.role === 'purchaser';
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const { showToast } = useToast();

  const fetchBrands = async () => {
    try {
      const res = await api.get('/api/brands');
      setBrands(res.data.brands || []);
    } catch {
      setError('Failed to load brands');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBrands(); }, []);

  const openCreate = () => {
    setEditing(null);
    setName('');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (brand: Brand) => {
    setEditing(brand);
    setName(brand.name);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) {
        await api.put(`/api/brands/${editing.id}`, { name });
      } else {
        await api.post('/api/brands', { name });
      }
      setModalOpen(false);
      showToast(editing ? 'Brand updated successfully!' : 'Brand created successfully!', 'success');
      fetchBrands();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      setError(axiosError.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (brand: Brand) => {
    if (!confirm(`Delete brand "${brand.name}"?`)) return;
    try {
      await api.delete(`/api/brands/${brand.id}`);
      showToast('Brand deleted successfully!', 'success');
      fetchBrands();
    } catch {
      showToast('Failed to delete brand', 'error');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Brands</h1>
        {isAdmin && (
          <button onClick={openCreate} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
            Add Brand
          </button>
        )}
      </div>

      {error && !modalOpen && <p className="text-red-600 text-sm mb-4">{error}</p>}

      <DataTable
        columns={[
          { key: 'name', label: 'Name' },
        ]}
        data={brands}
        loading={loading}
        onEdit={isAdmin ? openEdit : undefined}
        onDelete={isAdmin ? handleDelete : undefined}
      />

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Brand' : 'New Brand'}>
        <form onSubmit={handleSubmit}>
          {error && <p className="text-red-600 text-sm mb-3">{error}</p>}
          <FormField label="Name" value={name} onChange={setName} required placeholder="Brand name" />
          <button type="submit" className="w-full mt-2 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 rounded-md cursor-pointer">
            {editing ? 'Update' : 'Create'}
          </button>
        </form>
      </Modal>
    </div>
  );
}


