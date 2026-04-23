import { useState, useEffect } from 'react';
import api from '../api/axios';
import { Printer, Calendar } from 'lucide-react';

const DATE_INPUT_FORMAT = 'en-CA';

function getLocalDateInputValue() {
  return new Date().toLocaleDateString(DATE_INPUT_FORMAT);
}

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

type DailySummaryApiResponse = Partial<DailySummary> | null | undefined;

function normalizeDailySummary(data: DailySummaryApiResponse, fallbackDate: string): DailySummary {
  return {
    date: typeof data?.date === 'string' && data.date ? data.date : fallbackDate,
    advisor_performance: Array.isArray(data?.advisor_performance) ? data.advisor_performance : [],
    category_sales: Array.isArray(data?.category_sales) ? data.category_sales : [],
    payment_summary: Array.isArray(data?.payment_summary) ? data.payment_summary : [],
    account_receivables: typeof data?.account_receivables === 'number' ? data.account_receivables : 0,
    total_sales: typeof data?.total_sales === 'number' ? data.total_sales : 0,
  };
}

export default function DailyReport() {
  const [date, setDate] = useState(getLocalDateInputValue);
  const [data, setData] = useState<DailySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const res = await api.get(`/api/reports/daily-summary?date=${encodeURIComponent(date)}&_t=${Date.now()}`);
      setData(normalizeDailySummary(res.data as DailySummaryApiResponse, date));
    } catch (error) {
      console.error('Failed to fetch report:', error);
      setData(null);
      setErrorMessage('Failed to load the daily summary. Check the selected date and your connection, then try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    const interval = setInterval(() => fetchReport(), 15000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const handlePrint = () => {
    window.print();
  };

  const advisorPerformance = data?.advisor_performance ?? [];
  const categorySales = data?.category_sales ?? [];
  const paymentSummary = data?.payment_summary ?? [];

  const totalQtySold = advisorPerformance.reduce((acc: number, curr: AdvisorPerformance) => acc + curr.tires_sold, 0) || 0;
  
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
    return paymentSummary.find((p: PaymentSummary) => p.method.toLowerCase() === key.toLowerCase())?.total || 0;
  };

  const totalGoodAsCash = paymentSummary.reduce((acc: number, curr: PaymentSummary) => acc + curr.total, 0) || 0;

  return (
    <div className="daily-report-print p-6">
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

      <div className="print-only mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Daily Summary Report</h1>
        <p className="text-sm text-gray-600">Report Date: {date}</p>
      </div>

      {errorMessage && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      {!errorMessage && !loading && data && data.total_sales === 0 && advisorPerformance.length === 0 && categorySales.length === 0 && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          No completed sales were found for {date}. If you expect data here, double-check the report date first.
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Total Sales</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? 'Loading...' : `₱${(data?.total_sales || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Items Sold</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? 'Loading...' : totalQtySold}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Good as Cash</p>
          <p className="text-2xl font-bold text-gray-900">{loading ? 'Loading...' : `₱${totalGoodAsCash.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Receivables</p>
          <p className="text-2xl font-bold text-amber-600">{loading ? 'Loading...' : `₱${(data?.account_receivables || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`}</p>
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
                {advisorPerformance.map((sa, i) => (
                  <tr key={sa.advisor_name} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">{i + 1}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{sa.advisor_name}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">{sa.tires_sold}</td>
                  </tr>
                ))}
                {advisorPerformance.length === 0 && (
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
                {categorySales.map((cat) => (
                  <tr key={cat.category} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{cat.category}</td>
                    <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900">₱{cat.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                  </tr>
                ))}
                {categorySales.length === 0 && (
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
        .print-only { display: none; }

        @media print {
          @page { margin: 0.5cm; size: portrait; }
          #root { display: block !important; min-height: auto !important; }
          .daily-report-print { display: block !important; padding: 0 !important; }
          .print-only { display: block !important; }
          .no-print { display: none !important; }
          .bg-gray-50 { background-color: #f9fafb !important; }
          body { background: white !important; }
        }
      `}</style>
    </div>
  );
}
