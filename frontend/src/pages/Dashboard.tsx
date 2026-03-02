import { useEffect, useState } from 'react';
import api from '../api/axios';
import { useAuth } from '../context/AuthContext';

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ products: 0, categories: 0, brands: 0, customers: 0, orders: 0 });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [pRes, catRes, bRes, custRes, oRes] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/categories'),
          api.get('/api/brands'),
          api.get('/api/customers'),
          api.get('/api/orders'),
        ]);
        setStats({
          products: pRes.data.products?.length || 0,
          categories: catRes.data.categories?.length || 0,
          brands: bRes.data.brands?.length || 0,
          customers: custRes.data.customers?.length || 0,
          orders: oRes.data.orders?.length || 0,
        });
      } catch {
        // silently fail
      }
    };
    fetchStats();
  }, []);

  const cards = [
    { label: 'Products', value: stats.products },
    { label: 'Categories', value: stats.categories },
    { label: 'Brands', value: stats.brands },
    { label: 'Customers', value: stats.customers },
    { label: 'Orders', value: stats.orders },
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-gray-900 mb-1">Dashboard</h1>
      <p className="text-sm text-gray-500 mb-8">Welcome back, {user?.name}.</p>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        {cards.map((stat) => (
          <div key={stat.label} className="border border-gray-200 rounded-lg p-4 bg-white">
            <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{stat.label}</p>
            <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Profile */}
      <div className="border border-gray-200 rounded-lg bg-white">
        <div className="px-4 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-900">Your Profile</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {[
            { label: 'Name', value: user?.name },
            { label: 'Email', value: user?.email },
            { label: 'Role', value: user?.role },
            { label: 'Joined', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '--' },
          ].map((row) => (
            <div key={row.label} className="px-4 py-3 flex justify-between items-center">
              <span className="text-sm text-gray-500">{row.label}</span>
              <span className="text-sm font-medium text-gray-900 capitalize">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
