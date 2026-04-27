import { useEffect, useState } from 'react';
import api from '../api/axios';

interface ActivityLog {
  id: number;
  user_id: number;
  user: { name: string; email: string };
  action: string;
  entity: string;
  entity_id: string;
  details: string;
  ip_address: string;
  created_at: string;
}

export default function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await api.get('/api/logs');
      setLogs(res.data.logs || []);
    } catch {
      // Silently fail - logs are not critical
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const getActionColor = (action: string) => {
    if (action.includes('DELETE')) return 'text-red-600 bg-red-50';
    if (action.includes('UPDATE_PRICE')) return 'text-orange-600 bg-orange-50';
    if (action.includes('UPDATE_ROLE')) return 'text-indigo-600 bg-indigo-50';
    if (action.includes('UPDATE')) return 'text-blue-600 bg-blue-50';
    if (action.includes('CREATE')) return 'text-green-600 bg-green-50';
    if (action.includes('LOGIN')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Activity Logs</h1>
        <p className="text-sm text-gray-500">Audit trail of sensitive administrative actions.</p>
      </div>

      <div className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden text-sm">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 font-medium text-gray-900">User</th>
              <th className="px-6 py-4 font-medium text-gray-900">Action</th>
              <th className="px-6 py-4 font-medium text-gray-900">Resource</th>
              <th className="px-6 py-4 font-medium text-gray-900">Details</th>
              <th className="px-6 py-4 font-medium text-gray-900">Date & IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {logs.map((log) => (
              <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="font-medium text-gray-900">{log.user?.name}</div>
                  <div className="text-xs text-gray-400">{log.user?.email}</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded text-xs font-semibold ${getActionColor(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">
                  {log.entity} #{log.entity_id}
                </td>
                <td className="px-6 py-4 text-gray-700 max-w-xs truncate" title={log.details}>
                  {log.details}
                </td>
                <td className="px-6 py-4 text-gray-500">
                  <div>{new Date(log.created_at).toLocaleString()}</div>
                  <div className="text-[10px] text-gray-300">{log.ip_address}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <div className="p-12 text-center text-gray-500">Loading logs...</div>}
        {!loading && logs.length === 0 && <div className="p-12 text-center text-gray-500">No activity recorded yet.</div>}
      </div>
    </div>
  );
}
