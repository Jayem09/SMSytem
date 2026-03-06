import { useEffect, useState } from 'react';
import api from '../api/axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, Package, Users, ShoppingCart, PhilippinePeso } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_sales: 0,
    total_expenses: 0,
    net_profit: 0,
    product_count: 0,
    order_count: 0,
    customer_count: 0,
    sales_trend: [] as { date: string; amount: number }[],
    low_stock_products: [] as { id: number; name: string; stock: number }[]
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/dashboard');
        setStats(prev => ({
          ...prev,
          ...res.data,
          sales_trend: res.data.sales_trend || [],
          low_stock_products: res.data.low_stock_products || []
        }));
      } catch (err) {
        console.error('Failed to fetch dashboard stats', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val);
  };

  if (loading) {
    return (
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-medium">Loading Business Intelligence...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Business Insights</h1>
          <p className="text-gray-500 mt-1">Hello {user?.name}, here's what's happening today.</p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Last Updated</p>
          <p className="text-sm font-medium text-gray-900">{new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* Low Stock Notification */}
      {stats.low_stock_products?.length > 0 && (
        <div className="mb-8 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center shadow-sm">
          <div className="p-2 bg-orange-100 rounded-lg mr-4">
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-orange-900">Inventory Alert</h3>
            <p className="text-xs text-orange-700">
              {stats.low_stock_products.length} products are running low on stock. Check the product catalog to restock.
            </p>
          </div>
          <a href="/products" className="text-xs font-bold text-orange-600 hover:text-orange-800 transition-colors bg-white px-4 py-2 rounded-lg border border-orange-200">
            VIEW PRODUCTS
          </a>
        </div>
      )}

      {/* Key Metrics Grid - Admin Only */}
      {user?.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Total Sales', value: stats.total_sales, color: 'blue', icon:PhilippinePeso, trend: '+12%' },
          { label: 'Total Expenses', value: stats.total_expenses, color: 'rose', icon: ShoppingCart, trend: '-5%' },
          { label: 'Net Profit', value: stats.net_profit, color: 'emerald', icon: TrendingUp, trend: '+18%' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-2xl bg-${card.color}-50 text-${card.color}-600 group-hover:scale-110 transition-transform duration-300`}>
                <card.icon className="w-6 h-6" />
              </div>
              <span className={`text-xs font-bold px-2 py-1 rounded-full bg-emerald-50 text-emerald-600`}>
                {card.trend}
              </span>
            </div>
            <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
            <h3 className="text-3xl font-bold text-gray-900 truncate">
              {formatCurrency(card.value)}
            </h3>
          </div>
        ))}
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Sales Chart - Admin Only */}
        {user?.role === 'admin' && (
        <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Revenue Stream</h2>
              <p className="text-sm text-gray-500">Sales performance for the last 30 days.</p>
            </div>
            <select className="text-xs font-bold border-gray-200 rounded-lg bg-gray-50 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500">
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
            </select>
          </div>
          <div className="h-[320px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.sales_trend || []}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  dy={10}
                  tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 12, fill: '#94a3b8' }}
                  tickFormatter={(val) => `₱${val > 1000 ? (val/1000).toFixed(1) + 'k' : val}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '16px', 
                    border: 'none', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    padding: '12px'
                  }}
                  itemStyle={{ fontWeight: 'bold' }}
                />
                <Area 
                  type="monotone" 
                  dataKey="amount" 
                  stroke="#3b82f6" 
                  strokeWidth={4}
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        )}

        {/* Operational Quick Stats - Visible to all */}
        <div className={`flex flex-col gap-6 ${user?.role !== 'admin' ? 'lg:col-span-3' : ''}`}>
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Inventory Summary</h2>
            <div className="space-y-6">
              {[
                { label: 'Total Products', value: stats.product_count, icon: Package, color: 'indigo' },
                { label: 'Total Orders', value: stats.order_count, icon: ShoppingCart, color: 'amber' },
                { label: 'Registered Customers', value: stats.customer_count, icon: Users, color: 'blue' },
              ].map((item, i) => (
                <div key={i} className="flex items-center group cursor-pointer">
                  <div className={`p-4 rounded-2xl bg-gray-50 text-gray-600 mr-4 group-hover:bg-gray-900 group-hover:text-white transition-colors duration-300`}>
                    <item.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="text-xs text-gray-500">Inventory Status: Healthy</p>
                  </div>
                  <div className="ml-auto text-xl font-bold text-gray-900">{item.value}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-8 rounded-3xl shadow-xl text-white overflow-hidden relative group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-150 transition-transform duration-700">
              <Package className="w-32 h-32" />
            </div>
            <h2 className="text-xl font-bold mb-2 relative z-10">Export Data</h2>
            <p className="text-sm text-gray-400 mb-6 relative z-10">Generate professional CSV reports for external auditing.</p>
            {user?.role === 'admin' ? (
              <button className="w-full bg-white text-gray-900 font-bold py-3 rounded-2xl relative z-10 hover:bg-gray-100 transition-colors">
                DOWNLOAD CSV
              </button>
            ) : (
              <button disabled className="w-full bg-gray-500 text-gray-300 font-bold py-3 rounded-2xl relative z-10 cursor-not-allowed">
                ADMIN USE ONLY
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

