import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Printer, Calendar } from 'lucide-react';

interface AdvisorPerformance {
  advisor_name: string;
  tires_sold: number;
}

interface CategorySale {
  category: string;
  total_sales: number;
}

interface PaymentSummary {
  method: string;
  total: number;
}

interface DailySummary {
  date: string;
  advisor_performance: AdvisorPerformance[];
  category_sales: CategorySale[];
  payment_summary: PaymentSummary[];
  account_receivables: number;
  total_sales: number;
}

export default function DailyReport() {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [data, setData] = useState<DailySummary | null>(null);

  useEffect(() => {
    fetchReport();
    const interval = setInterval(() => fetchReport(), 15000);
    return () => clearInterval(interval);
  }, [date]);

  const fetchReport = async () => {
    try {
      const res = await api.get(`/api/reports/daily-summary?date=${date}&_t=${Date.now()}`);
      setData(res.data);
    } catch (error) {
      console.error('Failed to fetch report:', error);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const totalQtySold = (data?.advisor_performance || []).reduce((acc: number, curr: AdvisorPerformance) => acc + curr.tires_sold, 0) || 0;
  
  const paymentMethodsDisplay = [
    { key: 'cash', label: 'Cash' },
    { key: 'dated_check', label: 'Dated Check' },
    { key: 'card', label: 'Credit Card' },
    { key: 'bank_transfer', label: 'Bank Transfer' },
    { key: 'gcash', label: 'GCash' },
    { key: 'post_dated_check', label: 'Post-Dated Check' },
    { key: 'claimed_downpayment', label: 'Claimed Downpayment' },
    { key: 'goodyear_voucher', label: 'Goodyear Voucher' },
    { key: 'ewt', label: 'EWT' },
    { key: 'trade_in', label: 'Trade In' },
  ];

  const getPaymentValue = (key: string) => {
    return (data?.payment_summary || []).find((p: PaymentSummary) => p.method.toLowerCase() === key.toLowerCase())?.total || 0;
  };

  const totalGoodAsCash = (data?.payment_summary || []).reduce((acc: number, curr: PaymentSummary) => acc + curr.total, 0) || 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 no-print">
        <h1 className="text-xl font-semibold text-gray-900">Daily Report</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent border-none text-sm focus:ring-0 cursor-pointer"
            />
          </div>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            Print
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900">₱{(data?.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Items Sold</p>
          <p className="text-2xl font-bold text-gray-900">{totalQtySold}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Good as Cash</p>
          <p className="text-2xl font-bold text-gray-900">₱{totalGoodAsCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Receivables</p>
          <p className="text-2xl font-bold text-amber-600">₱{(data?.account_receivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="col-span-7 space-y-6">
          {/* Advisor Performance */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Sales by Salesperson</h2>
            </div>
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Qty Sold</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.advisor_performance || []).map((sa, i) => (
                  <tr key={sa.advisor_name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{sa.advisor_name}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{sa.tires_sold}</td>
                  </tr>
                ))}
                {(!data?.advisor_performance || data.advisor_performance.length === 0) && (
                  <tr><td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-500">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Category Sales */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Sales by Category</h2>
            </div>
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                  <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data?.category_sales || []).map((cat) => (
                  <tr key={cat.category} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cat.category}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">₱{cat.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {(!data?.category_sales || data.category_sales.length === 0) && (
                  <tr><td colSpan={2} className="px-4 py-6 text-center text-sm text-gray-500">No data</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column */}
        <div className="col-span-5 space-y-6">
          {/* Payment Summary */}
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h2 className="text-sm font-semibold text-gray-900">Payment Summary</h2>
            </div>
            <div className="divide-y divide-gray-100">
              {paymentMethodsDisplay.map((pm) => (
                <div key={pm.key} className="px-4 py-2.5 flex items-center justify-between">
                  <span className="text-sm text-gray-700">{pm.label}</span>
                  <span className={`text-sm font-semibold ${getPaymentValue(pm.key) > 0 ? 'text-gray-900' : 'text-gray-400'}`}>
                    {getPaymentValue(pm.key) > 0 ? `₱${getPaymentValue(pm.key).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : '—'}
                  </span>
                </div>
              ))}
              <div className="px-4 py-3 bg-gray-50">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-700">Total</span>
                  <span className="text-lg font-bold text-indigo-600">₱{totalGoodAsCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          @page { margin: 0.5cm; size: portrait; }
          .no-print { display: none !important; }
          .bg-gray-50 { background-color: #f9fafb !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
