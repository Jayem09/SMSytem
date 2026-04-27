import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save } from 'lucide-react';
import api from '../api/axios';
import { useToast } from '../context/ToastContext';
import { startSyncManager, stopSyncManager, isOnline } from '../services/syncManager';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState('SMSystem');
  const [contactEmail, setContactEmail] = useState('johndinglasan12@gmail.com');
  const [offlineMode, setOfflineMode] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/settings') as { data: { store_name?: string; contact_email?: string } };
      if (res.data) {
        if (res.data.store_name) setStoreName(res.data.store_name);
        if (res.data.contact_email) setContactEmail(res.data.contact_email);
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.post('/api/settings', {
        store_name: storeName,
        contact_email: contactEmail,
      });
      showToast('Settings saved successfully!', 'success');
    } catch (err) {
      console.error('Failed to save settings', err);
      showToast('Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const toggleOfflineMode = () => {
    if (!offlineMode) {
      setOfflineMode(true);
      startSyncManager();
      showToast('Offline mode enabled', 'success');
    } else {
      setOfflineMode(false);
      stopSyncManager();
      showToast('Offline mode disabled', 'success');
    }
  };

  if (loading) {
    return <div className="p-6 h-full flex items-center justify-center"><div className="text-gray-400">Loading Configuration...</div></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-gray-900 text-white rounded-xl">
          <SettingsIcon className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">System Settings</h1>
          <p className="text-sm text-gray-500">Manage application configuration and preferences.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="border-b border-gray-100 p-6">
          <h2 className="text-lg font-bold text-gray-900">General Configuration</h2>
          <p className="text-sm text-gray-500 mt-1">Basic settings for the application interface and behavior.</p>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div className="space-y-4 max-w-md">
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Store Name</label>
              <input
                type="text"
                value={storeName}
                readOnly
                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Contact Email</label>
              <input
                type="email"
                value={contactEmail}
                readOnly
                className="w-full px-4 py-2 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-500 cursor-not-allowed outline-none"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-gray-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-all disabled:opacity-75 disabled:cursor-wait"
            >
              <Save className="w-4 h-4" />
              {saving ? 'SAVING...' : 'SAVE CHANGES'}
            </button>
          </div>
        </form>

        {/* Offline Mode Toggle */}
        <div className="bg-white rounded-lg shadow p-4 mb-4">
          <h3 className="font-medium mb-3">Offline Mode</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Enable offline mode</p>
              <p className="text-xs text-gray-500">Work without server connection</p>
            </div>
            <button
              onClick={toggleOfflineMode}
              className={`px-3 py-1 rounded ${offlineMode ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
                }`}
            >
              {offlineMode ? 'ON' : 'OFF'}
            </button>
          </div>

          {/* Connection status */}
          <div className="mt-3 pt-3 border-t">
            <p className="text-sm">
              Status: <span className={isOnline.value ? 'text-green-600' : 'text-red-600'}>
                {isOnline.value ? 'Online' : 'Offline'}
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
