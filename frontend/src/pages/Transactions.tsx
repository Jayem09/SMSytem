import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { Calendar, Search, FileText, X } from 'lucide-react';

interface TransactionRow {
  date: string;
  order_id: number;
  receipt_type: string;
  branch_name: string;
  customer_name: string;
  service_advisor_name: string;
  item_name: string;
  unit_of_measure: string;
  category_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  payment_method: string;
  order_status: string;
}

function getLocalDateValue() {
  return new Date().toLocaleDateString('en-CA');
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPayment(method: string) {
  const map: Record<string, string> = {
    cash: 'Cash',
    card: 'Credit Card',
    gcash: 'GCash',
    bank_transfer: 'Bank Transfer',
    dated_check: 'Dated Check',
    post_dated_check: 'Post-Dated Check',
    claimed_downpayment: 'Claimed DP',
    goodyear_voucher: 'GY Voucher',
    ewt: 'EWT',
    trade_in: 'Trade In',
  };
  return map[method] ?? method;
}

const QUICK_RANGES = [
  { label: 'Today', getDates: () => { const d = getLocalDateValue(); return { start: d, end: d }; } },
  { label: 'This Week', getDates: () => {
    const now = new Date();
    const mon = new Date(now);
    mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    return { start: mon.toLocaleDateString('en-CA'), end: now.toLocaleDateString('en-CA') };
  }},
  { label: 'This Month', getDates: () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: first.toLocaleDateString('en-CA'), end: now.toLocaleDateString('en-CA') };
  }},
];

export default function Transactions() {
  const today = getLocalDateValue();
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (search) params.set('search', search);
      const res = await api.get(`/api/transactions?${params.toString()}`);
      const data = res.data as { transactions: TransactionRow[] };
      setRows(data.transactions ?? []);
    } catch {
      setError('Failed to load transactions. Please try again.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, search]);

  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  const totalAmount = rows.reduce((sum, r) => sum + r.subtotal, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-gray-600" />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Transaction Log</h1>
        </div>
        <span className="text-sm text-gray-500">{rows.length} record{rows.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 mb-5 space-y-4">
        {/* Quick ranges */}
        <div className="flex items-center gap-2 flex-wrap">
          {QUICK_RANGES.map((q) => (
            <button
              key={q.label}
              onClick={() => { const { start, end } = q.getDates(); setStartDate(start); setEndDate(end); }}
              className="px-3 py-1.5 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 transition-colors"
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* Date range + Search */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white">
            <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="text-sm text-gray-700 outline-none"
            />
            <span className="text-gray-400 text-sm">→</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="text-sm text-gray-700 outline-none"
            />
          </div>

          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Search customer, item, advisor..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-sm text-gray-700 outline-none w-full"
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Branch</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Advisor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Item</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Category</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Qty</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">U/M</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Price</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 13 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-4 py-12 text-center text-gray-400">
                    No transactions found for the selected period.
                  </td>
                </tr>
              ) : (
                rows.map((row, i) => (
                  <tr key={`${row.order_id}-${i}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.date}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-mono text-gray-800">
                        {row.receipt_type || 'SI'}-{String(row.order_id).padStart(5, '0')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
                        row.receipt_type === 'DR'
                          ? 'bg-blue-50 text-blue-700'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {row.receipt_type || 'SI'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{row.branch_name || '—'}</td>
                    <td className="px-4 py-3 text-gray-800 whitespace-nowrap max-w-[160px] truncate" title={row.customer_name}>
                      {row.customer_name}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {row.service_advisor_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate" title={row.item_name}>
                      {row.item_name}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.category_name || '—'}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{row.quantity}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{row.unit_of_measure || 'pc'}</td>
                    <td className="px-4 py-3 text-right text-gray-700 whitespace-nowrap font-mono">
                      {formatCurrency(row.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap font-mono font-medium">
                      {formatCurrency(row.subtotal)}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{formatPayment(row.payment_method)}</td>
                  </tr>
                ))
              )}
            </tbody>

            {/* Footer totals */}
            {!loading && rows.length > 0 && (
              <tfoot>
                <tr className="bg-gray-50 border-t-2 border-gray-200">
                  <td colSpan={11} className="px-4 py-3 text-right text-sm font-medium text-gray-600">
                    Total ({rows.length} line items)
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-gray-900 whitespace-nowrap">
                    {formatCurrency(totalAmount)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
