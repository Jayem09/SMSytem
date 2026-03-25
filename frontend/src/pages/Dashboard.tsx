import { useEffect, useState } from 'react';
import api from '../api/axios';
import { PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, Package, Users, ShoppingCart, PhilippinePeso, MoreVertical, Download } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { Skeleton, SkeletonCard } from '../components/EmptyState';

interface OrderItem {
  product?: { name: string };
  quantity: number;
}

interface Order {
  id: number;
  created_at: string;
  customer?: { name: string };
  guest_name?: string;
  status: string;
  payment_method: string;
  total_amount: number;
  items?: OrderItem[];
}

// Theme colors - indigo based
const CHART_COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#6366f1', '#818cf8', '#4f46e5', '#3730a3'];

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'purchasing' || user?.role === 'purchaser';
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [timeRange, setTimeRange] = useState(30);
  const [stats, setStats] = useState({
    total_sales: 0,
    total_expenses: 0,
    net_profit: 0,
    sales_change: '0%',
    expenses_change: '0%',
    profit_change: '0%',
    product_count: 0,
    order_count: 0,
    customer_count: 0,
    sales_trend: [] as { date: string; amount: number }[],
    low_stock_products: [] as { id: number; name: string; stock: number }[],
    top_advisors_today: [] as { advisor_name: string; total_sales: number; order_count: number }[],
    top_products_today: [] as { product_name: string; category_name: string; total_qty: number; total_sales: number }[],
    category_profits: [] as { category_name: string; percentage: number }[],
    product_revenue: [] as { product: string; revenue: number; profit: number; income: number }[]
  });

  const [dropdownOpen, setDropdownOpen] = useState<'advisors' | 'products' | null>(null);


  useEffect(() => {
    const handleClickOutside = () => setDropdownOpen(null);
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await api.get('/api/dashboard');
        const data = res.data as Record<string, unknown>;
        setStats(prev => ({
          ...prev,
          ...data,
          sales_trend: (data.sales_trend as typeof prev.sales_trend) || [],
          low_stock_products: (data.low_stock_products as typeof prev.low_stock_products) || [],
          top_advisors_today: (data.top_advisors_today as typeof prev.top_advisors_today) || [],
          top_products_today: (data.top_products_today as typeof prev.top_products_today) || [],
          category_profits: (data.category_profits as typeof prev.category_profits) || [],
          product_revenue: (data.product_revenue as typeof prev.product_revenue) || []
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

  const exportToCSV = async () => {
    try {
      setExporting(true);
      const res = await api.get('/api/orders');
      const data = res.data as { orders?: unknown[] };
      const orders = data?.orders || [];

      if (!orders || orders.length === 0) {
        alert('No data to export.');
        return;
      }

      const headers = ['Order ID', 'Date', 'Customer', 'Status', 'Payment Method', 'Total Amount', 'Items Summary'];
      const rows = orders.map((o) => {
        const order = o as Order;
        const customerName = order.customer?.name || order.guest_name || 'Walk-In';
        const date = new Date(order.created_at).toLocaleDateString();
        const itemsSummary = order.items ? order.items.map((i) => `${i.product?.name || 'Unknown'} (x${i.quantity})`).join('; ') : '';

        return [
          order.id,
          `"${date}"`,
          `"${customerName.replace(/"/g, '""')}"`,
          `"${order.status}"`,
          `"${order.payment_method}"`,
          order.total_amount,
          `"${itemsSummary.replace(/"/g, '""')}"`
        ].join(',');
      });

      const csvContent = [headers.join(','), ...rows].join('\n');
      const base64 = btoa(unescape(encodeURIComponent(csvContent)));
      const url = `data:text/csv;charset=utf-8;base64,${base64}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sales_Report_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Export failed', err);
      alert('Failed to generate CSV report.');
    } finally {
      setExporting(false);
    }
  };

  const exportLeaderboard = (type: 'advisors' | 'products') => {
    try {
      let headers: string[] = [];
      let rows: string[] = [];
      let filename = '';

      if (type === 'advisors') {
        if (!stats.top_advisors_today?.length) return alert('No advisor data to export.');
        headers = ['Rank', 'Service Advisor', 'Total Sales (PHP)', 'Orders Completed'];
        rows = stats.top_advisors_today.map((a, i) => [
          (i + 1).toString(),
          `"${a.advisor_name.replace(/"/g, '""')}"`,
          a.total_sales.toString(),
          a.order_count.toString()
        ].join(','));
        filename = `Top_Advisors_${new Date().toISOString().slice(0, 10)}.csv`;
      } else {
        if (!stats.top_products_today?.length) return alert('No product data to export.');
        headers = ['Rank', 'Product Name', 'Category', 'Total Qty Sold', 'Total Sales (PHP)'];
        rows = stats.top_products_today.map((p, i) => [
          (i + 1).toString(),
          `"${p.product_name.replace(/"/g, '""')}"`,
          `"${(p.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
          p.total_qty.toString(),
          p.total_sales.toString()
        ].join(','));
        filename = `Top_Products_${new Date().toISOString().slice(0, 10)}.csv`;
      }

      const csvContent = [headers.join(','), ...rows].join('\n');
      const base64 = btoa(unescape(encodeURIComponent(csvContent)));
      const url = `data:text/csv;charset=utf-8;base64,${base64}`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.error('Leaderboard export failed', err);
      alert('Failed to generate export file.');
    }
  };

  if (loading) {
    return (
      <div className="p-6 mx-auto">
        <div className="mb-8">
          <Skeleton width="280px" height="36px" className="mb-2" />
          <Skeleton width="200px" height="20px" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
          <div className="flex justify-between items-center mb-6">
            <Skeleton width="160px" height="28px" />
            <Skeleton width="100px" height="36px" variant="rectangular" />
          </div>
          <Skeleton height="320px" variant="rectangular" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 mx-auto">
      { }
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Business Insights
          </h1>
          <p className="text-gray-500 mt-1">Hello {user?.name}, here's what's happening today.</p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Last Updated</p>
          <p className="text-sm font-medium text-gray-900">{new Date().toLocaleTimeString()}</p>
        </div>
      </div>
      { }
      {stats.low_stock_products && stats.low_stock_products?.length > 0 && (
        <div className="mb-8 p-4 bg-orange-50 border border-orange-100 rounded-2xl flex items-center shadow-sm">
          <div className="p-2 bg-orange-100 rounded-lg mr-4">
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-orange-900">Inventory Alert</h3>
            <p className="text-xs text-orange-700">
              {(stats?.low_stock_products?.length || 0)} products are running low on stock. Check the product catalog to restock.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                try {
                  const res = await api.post('/api/inventory/generate-pos');
                  const data = res.data as { message?: string };
                  alert(data.message || 'POs generated');
                } catch {
                  alert('Failed to generate POs');
                }
              }}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors bg-white px-4 py-2 rounded-lg border border-indigo-200"
            >
              GENERATE POS
            </button>
            <a href="/products" className="text-xs font-bold text-orange-600 hover:text-orange-800 transition-colors bg-white px-4 py-2 rounded-lg border border-orange-200">
              VIEW PRODUCTS
            </a>
          </div>
        </div>
      )}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {[
            { label: 'Total Sales', value: stats.total_sales, color: 'blue', icon: PhilippinePeso, trend: stats.sales_change },
            { label: 'Total Expenses', value: stats.total_expenses, color: 'rose', icon: ShoppingCart, trend: stats.expenses_change },
            { label: 'Net Profit', value: stats.net_profit, color: 'emerald', icon: TrendingUp, trend: stats.profit_change },
          ].map((card, i) => {
            const isNegative = card.trend.startsWith('-');
            const isPositive = card.trend.startsWith('+');
            const trendColor = isNegative ? 'rose' : (isPositive ? 'emerald' : 'gray');

            return (
              <div key={i} className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-lg transition-all duration-300 group">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-2xl bg-gray-100 text-gray-600 group-hover:scale-110 transition-transform duration-300">
                    <card.icon className="w-6 h-6" />
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full bg-${trendColor}-50 text-${trendColor}-600`}>
                    {card.trend}
                  </span>
                </div>
                <p className="text-sm font-medium text-gray-500 mb-1">{card.label}</p>
                <h3 className="text-3xl font-bold text-gray-900 truncate">
                  {formatCurrency(card.value)}
                </h3>
              </div>
            );
          })}
        </div>
      )}
      { }
      {isAdmin && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-gray-900">Revenue Stream</h2>
            </div>
            <select
              className="text-xs font-bold border-gray-200 rounded-lg bg-gray-50 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
              value={timeRange}
              onChange={(e) => setTimeRange(Number(e.target.value))}
            >
              <option value={30}>Last 30 Days</option>
              <option value={7}>Last 7 Days</option>
            </select>
          </div>

          {/* Top Section - Pie Chart */}
          <div className="mb-8">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Profit % of Total Revenue</h3>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={stats.category_profits.length > 0 
                      ? stats.category_profits.map(c => ({ name: c.category_name, value: c.percentage }))
                      : [{ name: 'No Data', value: 100 }]
                    }
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {CHART_COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Section - Bar and Line Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Bar Chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Product Wise Revenue</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={stats.product_revenue.length > 0 
                    ? stats.product_revenue.map(p => ({ product: p.product.substring(0, 12), revenue: p.revenue }))
                    : [{ product: 'No Data', revenue: 0 }]
                  }>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="product" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip />
                    <Bar dataKey="revenue" fill="#4f46e5" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {stats.product_revenue.length > 0 && (
                <p className="text-xs font-medium text-gray-500 mt-2">
                  Total: {formatCurrency(stats.product_revenue.reduce((sum, p) => sum + p.revenue, 0))}
                </p>
              )}
            </div>

            {/* Line Chart */}
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Total Income/Product</h3>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={stats.product_revenue.length > 0 
                    ? stats.product_revenue.map(p => ({ product: p.product.substring(0, 12), income: p.income }))
                    : [{ product: 'No Data', income: 0 }]
                  }>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis dataKey="product" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#6b7280' }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="income" stroke="#4f46e5" strokeWidth={2} dot={{ fill: '#4f46e5', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              {stats.product_revenue.length > 0 && (
                <p className="text-xs font-medium text-gray-500 mt-2">
                  Total: {formatCurrency(stats.product_revenue.reduce((sum, p) => sum + (p.profit || 0), 0))}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      { }
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
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
          {isAdmin ? (
            <button
              onClick={exportToCSV}
              disabled={exporting}
              className="w-full bg-white text-gray-900 font-bold py-3 rounded-2xl relative z-10 hover:bg-gray-100 transition-colors disabled:opacity-75 disabled:cursor-wait"
            >
              {exporting ? 'GENERATING...' : 'DOWNLOAD CSV'}
            </button>
          ) : (
            <button disabled className="w-full bg-gray-500 text-gray-300 font-bold py-3 rounded-2xl relative z-10 cursor-not-allowed">
              ADMIN USE ONLY
            </button>
          )}
        </div>

        { }
        {isAdmin && (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Today's Top Advisors</h2>
                <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase bg-emerald-50 px-2 py-1 rounded-lg">Live</span>
              </div>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'advisors' ? null : 'advisors'); }}
                  className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {dropdownOpen === 'advisors' && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg animate-in fade-in zoom-in-95 duration-100 z-50">
                    <button
                      onClick={() => exportLeaderboard('advisors')}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <Download className="w-4 h-4" /> Export CSV Data
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              {stats.top_advisors_today && stats.top_advisors_today.length > 0 ? (
                stats.top_advisors_today.map((advisor, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-black text-gray-300 w-4 text-center">{i + 1}</span>
                      <div>
                        <p className="font-bold text-gray-900 mb-0.5">{advisor.advisor_name}</p>
                        <p className="text-xs text-gray-400 font-medium">
                          {advisor.order_count} {advisor.order_count === 1 ? 'Sale' : 'Sales'} Completed
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-gray-900">
                      {formatCurrency(advisor.total_sales)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm font-medium text-gray-400">No credited advisor sales yet today.</p>
              )}
            </div>
          </div>
        )}

        { }
        {isAdmin && (
          <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Today's Top Products</h2>
                <span className="text-[10px] font-black tracking-widest text-emerald-500 uppercase bg-emerald-50 px-2 py-1 rounded-lg">Live</span>
              </div>
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'products' ? null : 'products'); }}
                  className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {dropdownOpen === 'products' && (
                  <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-100 rounded-xl shadow-lg animate-in fade-in zoom-in-95 duration-100 z-50">
                    <button
                      onClick={() => exportLeaderboard('products')}
                      className="w-full text-left px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 flex items-center gap-2 first:rounded-t-xl last:rounded-b-xl"
                    >
                      <Download className="w-4 h-4" /> Export CSV Data
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="space-y-6">
              {stats.top_products_today && stats.top_products_today.length > 0 ? (
                stats.top_products_today.map((product, i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="flex items-center gap-4">
                      <span className="text-lg font-black text-gray-300 w-4 text-center">{i + 1}</span>
                      <div>
                        <p className="font-bold text-gray-900 mb-0.5 line-clamp-1">{product.product_name}</p>
                        <p className="text-xs text-gray-400 font-medium tracking-wide">
                          {product.category_name?.toUpperCase() || 'UNCATEGORIZED'} • {product.total_qty} Sold
                        </p>
                      </div>
                    </div>
                    <span className="font-black text-gray-900 ml-4">
                      {formatCurrency(product.total_sales)}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm font-medium text-gray-400">No product sales yet today.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

