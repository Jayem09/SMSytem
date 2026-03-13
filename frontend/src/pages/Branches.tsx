import { useState, useEffect, type ReactNode } from 'react';
import { Search, Plus, Building2, MapPin, Phone, Edit, Activity } from 'lucide-react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';

interface Branch {
  id: number;
  name: string;
  code: string;
  address: string;
  phone: string;
  is_active: boolean;
}

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    address: '',
    phone: '',
    is_active: true
  });

  const fetchBranches = async () => {
    try {
      const res = await api.get('/api/branches');
      setBranches(res.data.branches);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBranches();
  }, []);

  const handleOpenModal = (branch: Branch | null = null) => {
    if (branch) {
      setEditingBranch(branch);
      setFormData({
        name: branch.name,
        code: branch.code,
        address: branch.address,
        phone: branch.phone,
        is_active: branch.is_active
      });
    } else {
      setEditingBranch(null);
      setFormData({
        name: '',
        code: '',
        address: '',
        phone: '',
        is_active: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingBranch) {
        await api.put(`/api/branches/${editingBranch.id}`, formData);
      } else {
        await api.post('/api/branches', formData);
      }
      setIsModalOpen(false);
      fetchBranches();
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to save branch');
    }
  };

  const columns = [
    { 
      key: 'name', 
      label: 'Branch Details',
      render: (item: Branch): ReactNode => (
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700 mr-3">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="font-bold text-gray-900">{item.name}</div>
            <div className="text-xs text-gray-400 font-mono uppercase">{item.code}</div>
          </div>
        </div>
      )
    },
    { 
      key: 'address', 
      label: 'Location',
      render: (item: Branch): ReactNode => (
        <div className="flex items-center text-sm text-gray-600">
          <MapPin className="w-4 h-4 mr-2 text-gray-400" />
          {item.address || 'No address set'}
        </div>
      )
    },
    { 
      key: 'phone', 
      label: 'Contact',
      render: (item: Branch): ReactNode => (
        <div className="flex items-center text-sm text-gray-600">
          <Phone className="w-4 h-4 mr-2 text-gray-400" />
          {item.phone || 'No phone set'}
        </div>
      )
    },
    { 
      key: 'is_active', 
      label: 'Status',
      render: (item: Branch): ReactNode => (
        <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
          item.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {item.is_active ? 'Active' : 'Inactive'}
        </span>
      )
    },
    {
      key: 'actions',
      label: '',
      render: (item: Branch): ReactNode => (
        <div className="flex justify-end pr-4">
          <button
            onClick={() => handleOpenModal(item)}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
          >
            <Edit className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const filteredBranches = branches.filter((b) => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    b.code.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold border-b-2 border-indigo-500 pb-2 inline-block text-gray-800">
            Branch Management
          </h1>
          <p className="text-gray-500 text-sm mt-2 flex items-center">
            <Activity className="w-4 h-4 mr-2 text-indigo-500" />
            Manage store locations and branch-specific details
          </p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center hover:bg-indigo-700 transition-colors shadow-sm font-medium"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Branch
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search branches..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredBranches}
          loading={loading}
        />
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingBranch ? 'Edit Branch' : 'Add New Branch'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <FormField
            label="Branch Name"
            value={formData.name}
            onChange={(val) => setFormData({ ...formData, name: val })}
            required
            placeholder="e.g. Lipa Branch"
          />
          <FormField
            label="Branch Code"
            value={formData.code}
            onChange={(val) => setFormData({ ...formData, code: val })}
            required
            placeholder="e.g. LIPA01"
          />
          <FormField
            label="Address"
            value={formData.address}
            onChange={(val) => setFormData({ ...formData, address: val })}
            placeholder="Full physical address"
          />
          <FormField
            label="Phone Number"
            value={formData.phone}
            onChange={(val) => setFormData({ ...formData, phone: val })}
            placeholder="Contact number"
          />
          
          <div className="flex items-center space-x-2 py-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
            />
            <label htmlFor="is_active" className="text-sm font-medium text-gray-700">
              Active and operational
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors font-medium shadow-sm"
            >
              {editingBranch ? 'Update Branch' : 'Create Branch'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
