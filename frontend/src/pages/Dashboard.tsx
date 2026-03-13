import { useEffect, useState, useMemo } from 'react';
import api from '../api/axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, Package, Users, ShoppingCart, PhilippinePeso, MoreVertical, Download } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';
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
    top_products_today: [] as { product_name: string; category_name: string; total_qty: number; total_sales: number }[]
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
        setStats(prev => ({
          ...prev,
          ...res.data,
          sales_trend: res.data.sales_trend || [],
          low_stock_products: res.data.low_stock_products || [],
          top_advisors_today: res.data.top_advisors_today || [],
          top_products_today: res.data.top_products_today || []
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

  const filteredSalesTrend = useMemo(() => {
    if (!stats.sales_trend || stats.sales_trend.length === 0) return [];
    if (timeRange === 30) return stats.sales_trend;
    
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeRange);
    cutoff.setHours(0, 0, 0, 0); 
    
    return stats.sales_trend.filter(d => new Date(d.date) >= cutoff);
  }, [stats.sales_trend, timeRange]);

  const exportToCSV = async () => {
    try {
      setExporting(true);
      const res = await api.get('/api/orders');
      const orders = res.data.orders;
      
      if (!orders || orders.length === 0) {
        alert('No data to export.');
        return;
      }

      const headers = ['Order ID', 'Date', 'Customer', 'Status', 'Payment Method', 'Total Amount', 'Items Summary'];
      const rows = orders.map((o: any) => {
        const customerName = o.customer?.name || o.guest_name || 'Walk-In';
        const date = new Date(o.created_at).toLocaleDateString();
        const itemsSummary = o.items ? o.items.map((i: any) => `${i.product?.name || 'Unknown'} (x${i.quantity})`).join('; ') : '';
        
        return [
          o.id,
          `"${date}"`,
          `"${customerName.replace(/"/g, '""')}"`,
          `"${o.status}"`,
          `"${o.payment_method}"`,
          o.total_amount,
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
      <div className="p-6 h-full flex items-center justify-center">
        <div className="text-gray-400 animate-pulse font-medium">Loading Business Intelligence...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            Business Insights
            {user?.branch && (
              <span className="text-sm font-black bg-indigo-500 text-white px-3 py-1 rounded-full uppercase tracking-widest shadow-sm">
                {user.branch.name}
              </span>
            )}
          </h1>
          <p className="text-gray-500 mt-1">Hello {user?.name}, here's what's happening today.</p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Last Updated</p>
          <p className="text-sm font-medium text-gray-900">{new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {}
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

      {}
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
                <div className={`p-3 rounded-2xl bg-${card.color}-50 text-${card.color}-600 group-hover:scale-110 transition-transform duration-300`}>
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

      {}
      {isAdmin && (
        <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Revenue Stream</h2>
              <p className="text-sm text-gray-500">Sales performance for the last {timeRange} days.</p>
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
          <div className="h-[320px] w-full min-h-[320px]">
            <ResponsiveContainer width="100%" height="100%" minHeight={320} minWidth={0}>
              <AreaChart data={filteredSalesTrend}>
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

      {}
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

          {}
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

          {}
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

