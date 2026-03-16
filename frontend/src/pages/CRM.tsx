import { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../api/axios';
import { 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Clock,
  Briefcase,
  DollarSign
} from 'lucide-react';

interface TopSpender {
  id: number;
  name: string;
  email: string;
  phone: string;
  total_spent: number;
  order_count: number;
  last_payment: string;
}

interface PopularCategory {
  category: string;
  count: number;
}

interface CRMData {
  total_customers: number;
  top_spenders: TopSpender[];
  recent_buyers: TopSpender[];
  at_risk: TopSpender[];
  popular_categories: PopularCategory[];
}

export default function CRM() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'purchasing' || user?.role === 'purchaser';
  const [data, setData] = useState<CRMData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAdmin) return;
    
    const fetchCRM = async () => {
      try {
        const res = await api.get('/api/customers/crm-stats');
        setData(res.data);
      } catch (err) {
        setError('Failed to load CRM data');
      } finally {
        setLoading(false);
      }
    };
    fetchCRM();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500">
        You do not have permission to view CRM Analytics.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 font-medium animate-pulse">
        Analyzing customer data...
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6">
        <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100">
          {error || 'Failed to analyze CRM data.'}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">CRM Analytics</h1>
        <p className="text-gray-500 mt-1">Customer relationship, behavioral analysis, and retention metrics.</p>
      </div>

      {}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Total Profiled Clients</p>
            <h3 className="text-3xl font-black text-gray-900">{data.total_customers.toLocaleString()}</h3>
          </div>
          <div className="text-gray-400">
            <Users className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Recent Active (30d)</p>
            <h3 className="text-3xl font-black text-gray-900">{(data.recent_buyers || []).length}</h3>
          </div>
          <div className="text-gray-400">
            <TrendingUp className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">At-Risk Accounts</p>
            <h3 className="text-3xl font-black text-gray-900">{(data.at_risk || []).length}</h3>
          </div>
          <div className="text-gray-400">
            <AlertTriangle className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-1">Top Spend Value</p>
            <h3 className="text-3xl font-black text-gray-900">
              {(data.top_spenders || []).length > 0 ? `₱${data.top_spenders[0].total_spent.toLocaleString()}` : '₱0'}
            </h3>
          </div>
          <div className="text-gray-400">
            <DollarSign className="w-6 h-6" strokeWidth={1.5} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden lg:col-span-2">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
              Highest Value Customers
            </h2>
          </div>
          <div className="p-0">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Spent</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Purchase</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {(data.top_spenders || []).length === 0 ? (
                  <tr><td colSpan={4} className="px-6 py-8 text-center text-sm text-gray-400">Not enough data to analyze highest value customers.</td></tr>
                ) : (data.top_spenders || []).map((s, i) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs mr-3 bg-gray-100 text-gray-600`}>
                          #{i + 1}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{s.name}</div>
                          <div className="text-xs text-gray-500">{s.phone || 'No phone'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-black text-gray-900">
                      ₱{s.total_spent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-medium">
                      {s.order_count}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 flex items-center gap-2">
                      <Clock className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.5} />
                      {new Date(s.last_payment).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Briefcase className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
              Popular Categories
            </h2>
            <p className="text-xs text-gray-500 mt-1">What your clients buy most</p>
          </div>
          <div className="p-6 flex-1 flex flex-col justify-center">
            {(data.popular_categories || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center">No categories ranked yet.</p>
            ) : (
              <div className="space-y-5">
                {(data.popular_categories || []).map((c, i) => {
                  const maxCount = data.popular_categories[0]?.count || 1;
                  const percentage = Math.round((c.count / maxCount) * 100);
                  return (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-bold text-gray-700">{c.category || 'Uncategorized'}</span>
                        <span className="text-gray-500 font-medium">{c.count} items</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div className="bg-gray-800 h-2.5 rounded-full transition-all duration-1000" style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-gray-400" strokeWidth={1.5} />
              At-Risk Customers (60+ Days Inactive)
            </h2>
            <p className="text-sm text-gray-500 mt-1">These clients used to buy from you, but haven't placed an order in over 2 months.</p>
          </div>
        </div>
        <div className="p-0">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Client Details</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Lifetime Value</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Last Purchase Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {(data.at_risk || []).length === 0 ? (
                <tr><td colSpan={3} className="px-6 py-8 text-center text-sm font-medium text-gray-500 bg-white">Great job! You have 0 at-risk customers right now.</td></tr>
              ) : (data.at_risk || []).map((s) => (
                <tr key={s.id} className="bg-white hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-900">{s.name}</div>
                    <div className="text-xs text-gray-500">{s.phone} | {s.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    ₱{s.total_spent.toLocaleString()} ({s.order_count} orders)
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-bold flex items-center gap-2">
                    <Clock className="w-4 h-4" strokeWidth={1.5} />
                    {new Date(s.last_payment).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
