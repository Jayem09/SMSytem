import { useState, useEffect, type ReactNode } from 'react';
import { Search, Trash2, Shield, UserCog, Key } from 'lucide-react';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import FormField from '../components/FormField';
import { useAuth } from '../hooks/useAuth';

interface StaffUser {
  id: number;
  name: string;
  email: string;
  role: string;
  branch_id: number;
  branch_name: string;
  branch?: {
    id: number;
    name: string;
  };
  created_at: string;
}

export default function Staff() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [branches, setBranches] = useState<{id: number, name: string}[]>([]);
  
  
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<StaffUser | null>(null);

  
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [userToReset, setUserToReset] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetting, setIsResetting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/api/users');
      setUsers(res.data.users || []);
    } catch (error) {
      console.error('Failed to fetch users:', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchBranches = async () => {
    try {
      const res = await api.get('/api/branches');
      setBranches(res.data.branches || []);
    } catch (error) {
      console.error('Failed to fetch branches:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchBranches();
  }, []);

  const handleRoleChange = async (userId: number, newRole: string) => {
    try {
      await api.put(`/api/users/${userId}/role`, { role: newRole });
      fetchUsers();
    } catch (error: unknown) {
      const e = error as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Failed to update user role');
      fetchUsers();
    }
  };

  const handleBranchChange = async (userId: number, branchId: number) => {
    try {
      await api.put(`/api/users/${userId}/branch`, { branch_id: branchId });
      fetchUsers();
    } catch (error: unknown) {
      const e = error as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Failed to update user branch');
      fetchUsers();
    }
  };

  const confirmDelete = (user: StaffUser) => {
    setUserToDelete(user);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!userToDelete) return;
    try {
      await api.delete(`/api/users/${userToDelete.id}`);
      setIsDeleteModalOpen(false);
      setUserToDelete(null);
      fetchUsers();
    } catch (error: unknown) {
      const e = error as { response?: { data?: { error?: string } } };
      alert(e.response?.data?.error || 'Failed to delete user');
    }
  };

  const openResetModal = (user: StaffUser) => {
    setUserToReset(user);
    setNewPassword('');
    setConfirmPassword('');
    setResetError('');
    setIsResetModalOpen(true);
  };

  const handleResetPassword = async () => {
    if (!userToReset) return;
    if (newPassword.length < 6) {
      setResetError('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setResetError('Passwords do not match');
      return;
    }

    setIsResetting(true);
    setResetError('');
    try {
      await api.put(`/api/users/${userToReset.id}/reset-password`, {
        password: newPassword
      });
      setIsResetModalOpen(false);
      setUserToReset(null);
      alert('Password reset successfully.');
    } catch (error: unknown) {
      const e = error as { response?: { data?: { error?: string } } };
      setResetError(e.response?.data?.error || 'Failed to reset password');
    } finally {
      setIsResetting(false);
    }
  };

  const columns = [
    { 
      key: 'name', 
      label: 'Staff Name',
      render: (item: StaffUser): ReactNode => (
        <div className="flex items-center">
          <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3">
            {item.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-gray-900">
              {item.name} {item.id === currentUser?.id ? <span className="text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full ml-2">(You)</span> : ''}
            </div>
          </div>
        </div>
      )
    },
    { key: 'email', label: 'Email Address' },
    { 
      key: 'role', 
      label: 'System Role',
       render: (item: StaffUser): ReactNode => (
         <select
          value={item.role}
          onChange={(e) => handleRoleChange(item.id, e.target.value)}
          disabled={item.id === currentUser?.id || (currentUser?.role !== 'super_admin' && item.role === 'super_admin')}
          className={`text-sm rounded-lg border-gray-300 py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 font-medium ${
            item.role === 'admin' || item.role === 'super_admin' ? 'text-indigo-700 bg-indigo-50 border-indigo-200' : 'text-gray-700 bg-gray-50'
          } ${(item.id === currentUser?.id || (currentUser?.role !== 'super_admin' && item.role === 'super_admin')) ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
        >
          {currentUser?.role === 'super_admin' && <option value="super_admin">Super Admin (Owner)</option>}
          <option value="admin">Branch Admin (Manager)</option>
          <option value="purchasing">Purchasing (Inventory)</option>
          <option value="user">Verified User (Regular)</option>
          <option value="pending">Pending Approval (New)</option>
        </select>
      )
    },
    { 
      key: 'branch', 
      label: 'Branch Assignment',
      render: (item: StaffUser): ReactNode => (
        currentUser?.role === 'super_admin' ? (
          <select
            value={item.branch_id}
            onChange={(e) => handleBranchChange(item.id, parseInt(e.target.value))}
            className="text-sm rounded-lg border-gray-300 py-1.5 pl-3 pr-8 focus:ring-indigo-500 focus:border-indigo-500 font-medium text-gray-700 bg-gray-50 cursor-pointer"
          >
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        ) : (
          <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {item.branch_name}
          </span>
        )
      )
    },
    { key: 'created_at', label: 'Registered On' },
    {
      key: 'actions',
      label: '',
      render: (item: StaffUser): ReactNode => (
        <div className="flex justify-end pr-4 space-x-2">
          <button
            onClick={() => openResetModal(item)}
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="Reset Password"
          >
            <Key className="w-4 h-4" />
          </button>
          <button
            onClick={() => confirmDelete(item)}
            disabled={item.id === currentUser?.id}
            className={`p-2 rounded-lg transition-colors ${
              item.id === currentUser?.id 
                ? 'text-gray-300 cursor-not-allowed' 
                 : 'text-red-500 hover:bg-red-50'
            }`}
            title={item.id === currentUser?.id ? "Cannot delete yourself" : "Delete Account"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  const filteredUsers = (users || []).filter((u) => 
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6 mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold border-b-2 border-indigo-500 pb-2 inline-block text-gray-800">
            Staff & Roles
          </h1>
          <p className="text-gray-500 text-sm mt-2 flex items-center">
            <Shield className="w-4 h-4 mr-2 text-indigo-500" />
            Manage team access levels and security permissions
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-200 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search staff by name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          data={filteredUsers}
          loading={loading}
        />
      </div>

      <Modal
        open={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Revoke Access"
      >
        <div className="space-y-4">
          <div className="bg-red-50 p-4 rounded-lg flex items-start">
             <UserCog className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
             <p className="text-sm text-red-800">
                Are you sure you want to permanently delete the account for <strong>{userToDelete?.name}</strong>? 
                This action cannot be undone and they will immediately lose access to the system.
             </p>
          </div>
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100">
            <button
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              className="px-4 py-2 text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </button>
          </div>
        </div>
      </Modal>

      {}
      <Modal
        open={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        title="Reset Password"
      >
        <div className="space-y-4">
          <div className="bg-indigo-50 p-4 rounded-lg flex items-start mb-4">
             <Key className="w-5 h-5 text-indigo-600 mt-0.5 mr-3 flex-shrink-0" />
             <p className="text-sm text-indigo-800">
                Resetting password for <strong>{userToReset?.name}</strong> ({userToReset?.email}).
             </p>
          </div>

          <FormField
            label="New Password"
            type="password"
            value={newPassword}
            onChange={setNewPassword}
            required
            placeholder="At least 6 characters"
          />
          <FormField
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            required
            placeholder="Re-type new password"
          />

          {resetError && (
            <div className="text-red-500 text-sm bg-red-50 p-3 rounded-lg border border-red-100 font-medium">
              {resetError}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-100 mt-6">
            <button
              onClick={() => setIsResetModalOpen(false)}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors font-medium"
              disabled={isResetting}
            >
              Cancel
            </button>
            <button
              onClick={handleResetPassword}
              disabled={isResetting}
              className={`px-4 py-2 text-white bg-indigo-600 rounded-lg transition-colors font-medium flex items-center ${
                isResetting ? 'opacity-70 cursor-not-allowed' : 'hover:bg-indigo-700'
              }`}
            >
              {isResetting ? 'Resetting...' : 'Confirm Reset'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
