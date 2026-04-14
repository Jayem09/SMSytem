import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { Upload, Download, Database, Clock, AlertTriangle, CheckCircle, RefreshCw, Trash2, FileText } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://168.144.46.137:8080';

interface Backup {
  id: number;
  filename: string;
  size: number;
  created_at: string;
  type: 'manual' | 'auto';
  status: 'completed' | 'failed' | 'in_progress';
}

export default function Backups() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [restoring, setRestoring] = useState<number | null>(null);

  const fetchBackups = useCallback(async () => {
    try {
      const res = await api.get('/api/backups');
      setBackups(res.data.backups || res.data || []);
    } catch (err) {
      console.error('Failed to fetch backups', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBackups();
  }, [fetchBackups]);

  if (user?.role !== 'admin' && user?.role !== 'super_admin') {
    navigate('/dashboard');
    return null;
  }

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      await api.post('/api/backups');
      showToast('Backup created successfully', 'success');
      fetchBackups();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { error?: string } } };
      showToast(axiosError.response?.data?.error || 'Backup failed', 'error');
    }
    setCreating(false);
  };

const handleDeleteBackup = async (id: number) => {
    console.log('handleDelete called:', id);
    // Skip confirm for testing - just delete
    try {
      const res = await api.delete(`/api/backups/${id}`);
      console.log('Delete response:', res);
      showToast('Backup deleted', 'success');
      fetchBackups();
    } catch (err: unknown) {
      console.error('Delete error:', err);
      const axiosError = err as { response?: { data?: { error?: string } } };
      showToast(axiosError.response?.data?.error || 'Delete failed', 'error');
    }
  };

  const handleRestoreBackup = async (id: number) => {
    console.log('handleRestore called:', id);
    setRestoring(id);
    try {
      const res = await api.post(`/api/backups/${id}/restore`);
      console.log('Restore response:', res);
      showToast('Backup restored successfully', 'success');
      fetchBackups();
    } catch (err: unknown) {
      console.error('Restore error:', err);
      const axiosError = err as { response?: { data?: { error?: string } };
      showToast(axiosError.response?.data?.error || 'Restore failed', 'error');
    }
    setRestoring(null);
  };

  const handleDownloadBackup = async (id: number, filename: string) => {
    console.log('handleDownload called:', id, filename);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/backups/${id}/download`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      console.log('Download response:', response.status);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      console.log('Blob size:', blob.size);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Download started', 'success');
    } catch (err) {
      console.error('Download error:', err);
      showToast('Download failed', 'error');
    }
  };

  const handleRestoreBackup = async (id: number) => {
    if (!confirm('Are you sure you want to restore this backup? This will overwrite current data.')) {
      return;
    }
    setRestoring(id);
    try {
      const res = await api.post(`/api/backups/${id}/restore`);
      console.log('Restore response:', res);
      showToast('Backup restored successfully. Refreshing...', 'success');
      fetchBackups();
    } catch (err: unknown) {
      console.error('Restore error:', err);
      const axiosError = err as { response?: { data?: { error?: string } } };
      showToast(axiosError.response?.data?.error || 'Restore failed', 'error');
    }
    setRestoring(null);
  };

  const handleDownloadBackup = async (id: number, filename: string) => {
    console.log('Download clicked:', id, filename);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE}/api/backups/${id}/download`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      
      console.log('Download response:', response.status, response.statusText);
      if (!response.ok) throw new Error('Download failed');
      
      const blob = await response.blob();
      console.log('Blob size:', blob.size);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download error:', err);
      showToast('Download failed', 'error');
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading && backups.length === 0) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 text-gray-400 animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Loading backups...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Backup & Restore</h1>
          <p className="text-sm text-gray-500 mt-1">Manage database backups and restore points</p>
        </div>
        <button
          onClick={handleCreateBackup}
          disabled={creating}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {creating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Create Backup
            </>
          )}
        </button>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 rounded-xl border border-blue-200">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">Database Backups</p>
            <p className="text-xs text-blue-600 mt-1">
              Backups include all tables: customers, orders, products, inventory, loyalty_ledgers, and settings. 
              Store backups securely and test restores periodically.
            </p>
          </div>
        </div>
      </div>

      {/* Backup List */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Backup History</h2>
        </div>
        
        {backups.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No backups yet</p>
            <p className="text-sm text-gray-400 mt-1">Create your first backup to get started</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {backups.map((backup) => (
              <div key={backup.id} className="px-5 py-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${
                    backup.status === 'completed' ? 'bg-emerald-50' :
                    backup.status === 'failed' ? 'bg-red-50' :
                    'bg-amber-50'
                  }`}>
                    {backup.status === 'completed' ? (
                      <CheckCircle className="w-5 h-5 text-emerald-600" />
                    ) : backup.status === 'failed' ? (
                      <AlertTriangle className="w-5 h-5 text-red-600" />
                    ) : (
                      <Clock className="w-5 h-5 text-amber-600 animate-pulse" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{backup.filename}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-gray-400">{formatSize(backup.size)}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className="text-xs text-gray-400">{formatDate(backup.created_at)}</span>
                      <span className="text-xs text-gray-400">•</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        backup.type === 'manual' 
                          ? 'bg-indigo-50 text-indigo-600' 
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {backup.type}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {backup.status === 'completed' && (
                    <>
                      <button
                        onClick={() => {
                          console.log('Download click');
                          handleDownloadBackup(backup.id, backup.filename);
                        }}
                        className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          console.log('Restore click');
                          handleRestoreBackup(backup.id);
                        }}
                        disabled={restoring === backup.id}
                        className="p-2 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                        title="Restore"
                      >
                        {restoring === backup.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                      </button>
                    </>
                  )}
                  <button
                    onMouseDown={(e) => console.log('MouseDown delete')}
                    onMouseUp={(e) => console.log('MouseUp delete')}
                    onClick={(e) => {
                      console.log('onClick delete fired');
                      e.stopPropagation();
                      alert('Delete button click! id=' + backup.id);
                      handleDeleteBackup(backup.id);
                    }}
                    className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}