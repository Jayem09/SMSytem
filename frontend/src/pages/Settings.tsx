import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Plus, Trash2 } from 'lucide-react';
import api from '../api/axios';

export default function Settings() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storeName, setStoreName] = useState('SMSystem');
  const [contactEmail, setContactEmail] = useState('admin@smsystem.com');
  const [serviceAdvisors, setServiceAdvisors] = useState<string[]>([]);
  const [newAdvisor, setNewAdvisor] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/settings');
      if (res.data) {
        if (res.data.store_name) setStoreName(res.data.store_name);
        if (res.data.contact_email) setContactEmail(res.data.contact_email);
        if (res.data.service_advisors) {
          try {
            const parsed = Array.isArray(res.data.service_advisors) 
              ? res.data.service_advisors 
              : JSON.parse(res.data.service_advisors);
            setServiceAdvisors(parsed);
          } catch (e) {
            console.error("Failed to parse SAs", e);
          }
        }
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
        service_advisors: JSON.stringify(serviceAdvisors)
      });
      alert('Settings saved successfully!');
    } catch (err) {
      console.error('Failed to save settings', err);
      alert('Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const addAdvisor = () => {
    if (newAdvisor.trim() && !serviceAdvisors.includes(newAdvisor.trim())) {
      setServiceAdvisors([...serviceAdvisors, newAdvisor.trim()]);
      setNewAdvisor('');
    }
  };

  const removeAdvisor = (name: string) => {
    setServiceAdvisors(serviceAdvisors.filter(sa => sa !== name));
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
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">System Settings</h1>
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
                onChange={e => setStoreName(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
              />
            </div>
            
            <div>
              <label className="block text-sm font-bold text-gray-900 mb-2">Contact Email</label>
              <input 
                type="email" 
                value={contactEmail}
                onChange={e => setContactEmail(e.target.value)}
                className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
              />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-6">
            <h2 className="text-lg font-bold text-gray-900">Service Advisors</h2>
            <p className="text-sm text-gray-500 mt-1 mb-4">Manage the list of service advisors available for checkout attribution.</p>
            
            <div className="max-w-md">
              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={newAdvisor}
                  onChange={e => setNewAdvisor(e.target.value)}
                  placeholder="Enter advisor name..."
                  className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-gray-900/20 focus:border-gray-900 outline-none transition-all"
                  onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addAdvisor())}
                />
                <button 
                  type="button"
                  onClick={addAdvisor}
                  disabled={!newAdvisor.trim()}
                  className="px-4 py-2 bg-gray-900 text-white rounded-xl hover:bg-gray-800 disabled:opacity-50 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                {serviceAdvisors.length === 0 ? (
                  <div className="p-4 text-center text-sm text-gray-400">No advisors configured.</div>
                ) : (
                  <ul className="divide-y divide-gray-200">
                    {serviceAdvisors.map((advisor) => (
                      <li key={advisor} className="flex justify-between items-center p-3 hover:bg-white transition-colors">
                        <span className="text-sm font-medium text-gray-900">{advisor}</span>
                        <button 
                          type="button"
                          onClick={() => removeAdvisor(advisor)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
      </div>
    </div>
  );
}
