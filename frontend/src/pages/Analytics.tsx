import { useState } from 'react';
import api from '../api/axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { Send, Bot, AlertCircle, Loader2, Sparkles } from 'lucide-react';

const QUICK_QUERIES = [
  { label: 'Revenue this month', query: 'how much did we earn this month' },
  { label: 'Best selling products', query: 'best selling products' },
  { label: 'Low stock items', query: 'low stock items' },
  { label: 'Top customers', query: 'who are our top customers' },
  { label: 'Profit this month', query: 'profit this month' },
  { label: 'Service advisor performance', query: 'service advisor performance' },
  { label: 'Sales by category', query: 'sales by category' },
  { label: 'Daily summary', query: "today's summary" },
];

const COLORS = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#f59e0b', '#84cc16'];

interface HistoryItem {
  id: number;
  // Original user query for display
  query: string;
  // Answer returned from the backend (rendered in UI)
  answer: string;
  // Additional data to render charts/tables (if any)
  data: Record<string, unknown> | null;
  // Chart type string (metric/bar/pie/...) for renderChart
  chartType: string;
  // Optional: type marker to support future extension
  type?: string;
}

export default function Analytics() {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [error, setError] = useState('');

  const sendQuery = async (q: string) => {
    if (!q.trim()) return;
    
    const questionId = Date.now();
    // Push a new entry to show the question immediately with a loading state
    setHistory(prev => [...prev, { id: questionId, type: 'question', query: q, answer: '', data: null, chartType: '' }]);
    setQuestion('');
    setLoading(true);
    setError('');

    try {
      const res = await api.get(`/api/analytics?q=${encodeURIComponent(q)}`);
      // Be defensive in case the backend shape changes slightly
      const answer = res?.data?.answer ?? '';
      const data = res?.data?.data ?? null;
      const chartType = res?.data?.chart_type ?? '';
      setHistory(prev => prev.map(h => 
        h.id === questionId 
          ? { ...h, answer, data, chartType }
          : h
      ));
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      setError(error.response?.data?.error || 'Failed to fetch analytics');
      setHistory(prev => prev.filter(h => h.id !== questionId));
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(val || 0);
  };

  interface ChartDataItem {
    product_name?: string;
    advisor_name?: string;
    customer_name?: string;
    label?: string;
    category_name?: string;
    brand_name?: string;
    total_sales?: number;
    total?: number;
    value?: number;
    total_qty?: number;
  }

  const renderChart = (data: Record<string, unknown> | null, chartType: string) => {
    if (!data) return null;

    if (chartType === 'metric') {
      if (data.total !== undefined) {
        return (
          <div className="text-center py-4">
            <div className="text-4xl font-bold text-indigo-600">{formatCurrency(Number(data.total))}</div>
            <div className="text-gray-500 mt-1">Total Value</div>
          </div>
        );
      }
      if (data.revenue !== undefined) {
        return (
          <div className="text-center py-4 space-y-2">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-green-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-green-600">{formatCurrency(Number(data.revenue))}</div>
                <div className="text-xs text-green-600">Revenue</div>
              </div>
              <div className="bg-red-50 rounded-lg p-3">
                <div className="text-2xl font-bold text-red-600">{formatCurrency(Number(data.expenses))}</div>
                <div className="text-xs text-red-600">Expenses</div>
              </div>
              <div className={`rounded-lg p-3 ${Number(data.profit) >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
                <div className={`text-2xl font-bold ${Number(data.profit) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{formatCurrency(Number(data.profit))}</div>
                <div className={`text-xs ${Number(data.profit) >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>{Number(data.profit) >= 0 ? 'Profit' : 'Loss'}</div>
              </div>
            </div>
          </div>
        );
      }
    }

    if ((chartType === 'bar' || chartType === 'pie') && Array.isArray(data)) {
      const chartData = (data as ChartDataItem[]).map((item) => ({
        name: item.product_name || item.advisor_name || item.customer_name || item.label || item.category_name || item.brand_name || 'Other',
        value: item.total_sales || item.total || item.value || item.total_qty || 0
      })).filter((d) => Number(d.value) > 0);

      if (chartData.length === 0) return null;

      if (chartType === 'pie') {
        return (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
                >
                  {chartData.map((_, index: number) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        );
      }

      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData.slice(0, 10)} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
              <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'line' && Array.isArray(data)) {
      const lineData = data as Array<{ date?: string; month?: string; week?: string; amount?: number; total?: number }>;
      const chartData = lineData.map((item) => ({
        name: item.date || item.month || item.week || 'N/A',
        value: item.amount || item.total || 0
      }));

      return (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis tickFormatter={(v) => `₱${(v/1000).toFixed(0)}k`} />
              <Tooltip formatter={(value) => formatCurrency(Number(value))} />
              <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      );
    }

    if (chartType === 'alert') {
      const alertData = data as unknown as Array<{ product_name?: string; current_stock?: number }>;
      return (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {alertData.slice(0, 10).map((item, index: number) => (
            <div key={index} className="flex items-center justify-between p-2 bg-red-50 rounded-lg border border-red-100">
              <span className="text-sm text-gray-800 truncate flex-1">{item.product_name}</span>
              <span className="text-xs font-mono bg-red-100 text-red-600 px-2 py-1 rounded">
                {item.current_stock || 0} left
              </span>
            </div>
          ))}
          {alertData.length > 10 && (
            <div className="text-center text-xs text-gray-500">+{alertData.length - 10} more items</div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">AI Analytics</h1>
            <p className="text-sm text-gray-500">Ask questions in plain English</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {history.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bot className="w-8 h-8 text-indigo-500" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 mb-2">Ask me anything!</h2>
            <p className="text-gray-500 mb-6 max-w-md mx-auto">
              I can answer questions about your sales, inventory, customers, and more.
            </p>
            
            <div className="flex flex-wrap gap-2 justify-center max-w-2xl mx-auto">
              {QUICK_QUERIES.map((q, i) => (
                <button
                  key={i}
                  onClick={() => sendQuery(q.query)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-600 transition-colors"
                >
                  {q.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {history.map((item) => (
          <div key={item.id} className="space-y-4">
            <div className="flex gap-3">
              <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                <span className="text-sm font-bold text-indigo-600">Q</span>
              </div>
              <div className="flex-1">
                <p className="text-gray-900 font-medium">{item.query}</p>
              </div>
            </div>

            {item.answer && (
              <div className="flex gap-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0 mt-1">
                  <span className="text-sm font-bold text-green-600">A</span>
                </div>
                <div className="flex-1 bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                  {item.chartType && renderChart(item.data, item.chartType)}
                  <pre className={`whitespace-pre-wrap text-sm text-gray-700 font-sans ${item.chartType ? 'mt-4 pt-4 border-t border-gray-100' : ''}`}>
                    {item.answer}
                  </pre>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <Loader2 className="w-4 h-4 text-gray-500 animate-spin" />
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <p className="text-gray-500">Analyzing your data...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-red-500" />
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <p className="text-red-600">{error}</p>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white border-t border-gray-200 p-4">
        <form onSubmit={(e) => { e.preventDefault(); sendQuery(question); }} className="flex gap-3">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask a question... (e.g., 'how much did we earn this month?')"
            className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!question.trim() || loading}
            className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Ask
          </button>
        </form>
        
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-gray-400">Try:</span>
          {['revenue', 'orders', 'profit', 'expenses'].map((topic) => (
            <button
              key={topic}
              onClick={() => sendQuery(`${topic} this month`)}
              className="text-xs text-indigo-500 hover:underline"
            >
              {topic} this month
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
