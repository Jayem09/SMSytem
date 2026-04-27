import { useEffect, useMemo, useState } from 'react';
import api from '../api/axios';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../context/ToastContext';
import { exportOfftakeToExcel, type OfftakeExportFilters, type OfftakeReportRow } from '../utils/reportExports';
import { Calendar, Search, FileText, Download, X } from 'lucide-react';

function getLocalDateValue() {
  return new Date().toLocaleDateString('en-CA');
}

function formatCurrency(n: number) {
  return n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

export default function OfftakeReport() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isSuperAdmin = user?.role === 'super_admin';

  // Default to this month
  const getDefaultDates = () => {
    const now = new Date();
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return {
      start: first.toLocaleDateString('en-CA'),
      end: now.toLocaleDateString('en-CA')
    };
  };
  const defaultDates = getDefaultDates();

  const [startDate, setStartDate] = useState(defaultDates.start);
  const [endDate, setEndDate] = useState(defaultDates.end);
  const [customer, setCustomer] = useState('');
  const [invoiceNo, setInvoiceNo] = useState('');
  const [itemName, setItemName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('all');
  const [serviceAdvisor, setServiceAdvisor] = useState('');
  const [branchFilter, setBranchFilter] = useState('ALL');
  const [branches, setBranches] = useState<{ id: number; name: string }[]>([]);
  const [rows, setRows] = useState<OfftakeReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<unknown>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  const filters: OfftakeExportFilters = useMemo(() => ({
    startDate,
    endDate,
    customer,
    invoiceNo,
    itemName,
    branchLabel: branches.find(b => b.id === Number(branchFilter))?.name ?? '',
    paymentStatus,
    serviceAdvisor,
  }), [startDate, endDate, customer, invoiceNo, itemName, branchFilter, branches, paymentStatus, serviceAdvisor]);

  // Fetch branches for super_admin
  useEffect(() => {
    if (!isSuperAdmin) return;
    api.get('/api/branches').then(res => {
      setBranches(res.data.branches ?? []);
    }).catch(() => {});
  }, [isSuperAdmin]);

  // Fetch off-take rows
  const fetchRows = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({
        start_date: startDate,
        end_date: endDate,
      });
      if (customer) params.set('customer', customer);
      if (invoiceNo) params.set('invoice_no', invoiceNo);
      if (itemName) params.set('item_name', itemName);
      if (paymentStatus !== 'all') params.set('payment_status', paymentStatus);
      if (serviceAdvisor) params.set('service_advisor', serviceAdvisor);
      if (branchFilter !== 'ALL') params.set('branch_id', branchFilter);

      const res = await api.get(`/api/reports/offtake?${params.toString()}`);
      const data = res.data as { rows: OfftakeReportRow[] };
      setRows(data.rows ?? []);
    } catch {
      setError('Failed to load off-take report. Please try again.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
  }, [startDate, endDate, customer, invoiceNo, itemName, paymentStatus, serviceAdvisor, branchFilter]);

  const handleExport = async () => {
    try {
      await exportOfftakeToExcel(rows, filters);
    } catch {
      showToast('Failed to export report', 'error');
    }
  };

  const handleRowClick = async (orderId: number) => {
    setSelectedOrderId(orderId);
    setDetailsLoading(true);
    try {
      const res = await api.get(`/api/orders/${orderId}`);
      setSelectedOrder(res.data.order ?? res.data);
    } catch {
      showToast('Failed to load order details', 'error');
    } finally {
      setDetailsLoading(false);
    }
  };

  const totalAmount = rows.reduce((sum, r) => sum + r.total_amount, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.amount_paid, 0);
  const totalBalance = rows.reduce((sum, r) => sum + r.balance_due, 0);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6 text-gray-600" />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Offtake Report</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{rows.length} invoice{rows.length !== 1 ? 's' : ''}</span>
          <button
            onClick={handleExport}
            disabled={rows.length === 0}
            className="flex items-center gap-2 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
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

        {/* Date range + Branch */}
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

          {isSuperAdmin && (
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
            >
              <option value="ALL">All Branches</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          )}

          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white"
          >
            <option value="all">All Payment Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </div>

        {/* Search inputs */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-[150px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Customer"
              value={customer}
              onChange={(e) => setCustomer(e.target.value)}
              className="text-sm text-gray-700 outline-none w-full"
            />
            {customer && (
              <button onClick={() => setCustomer('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-[150px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Invoice #"
              value={invoiceNo}
              onChange={(e) => setInvoiceNo(e.target.value)}
              className="text-sm text-gray-700 outline-none w-full"
            />
            {invoiceNo && (
              <button onClick={() => setInvoiceNo('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-[150px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Item name"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="text-sm text-gray-700 outline-none w-full"
            />
            {itemName && (
              <button onClick={() => setItemName('')} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2 bg-white flex-1 min-w-[150px]">
            <Search className="w-4 h-4 text-gray-400 shrink-0" />
            <input
              type="text"
              placeholder="Salesperson"
              value={serviceAdvisor}
              onChange={(e) => setServiceAdvisor(e.target.value)}
              className="text-sm text-gray-700 outline-none w-full"
            />
            {serviceAdvisor && (
              <button onClick={() => setServiceAdvisor('')} className="text-gray-400 hover:text-gray-600">
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

      {/* Summary */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500">Total Invoices</div>
          <div className="text-xl font-semibold text-gray-900">{rows.length}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500">Total Amount</div>
          <div className="text-xl font-semibold text-gray-900">₱{formatCurrency(totalAmount)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500">Total Paid</div>
          <div className="text-xl font-semibold text-gray-900">₱{formatCurrency(totalPaid)}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="text-sm text-gray-500">Balance Due</div>
          <div className="text-xl font-semibold text-gray-900">₱{formatCurrency(totalBalance)}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Invoice #</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Customer</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Branch</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Salesperson</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Paid</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Balance</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Items</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-4 py-8 text-center text-gray-500">No invoices found</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.order_id}
                    onClick={() => handleRowClick(row.order_id)}
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{row.invoice_no}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.invoice_date}</td>
                    <td className="px-4 py-3 text-gray-900 whitespace-nowrap">{row.customer_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.branch_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.service_advisor}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`px-2 py-0.5 text-xs rounded-full ${
                        row.payment_status === 'paid' ? 'bg-green-100 text-green-700' :
                        row.payment_status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {row.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900 whitespace-nowrap">₱{formatCurrency(row.total_amount)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">₱{formatCurrency(row.amount_paid)}</td>
                    <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">₱{formatCurrency(row.balance_due)}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[200px] truncate">{row.item_summary}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Details Modal */}
      <Modal isOpen={!!selectedOrderId} onClose={() => setSelectedOrderId(null)}>
        <div className="p-6 max-w-lg w-full">
          <h2 className="text-lg font-semibold mb-4">Order Details</h2>
          {detailsLoading ? (
            <p className="text-gray-500">Loading...</p>
          ) : selectedOrder ? (
            <div>
              <pre className="text-sm text-gray-600 whitespace-pre-wrap">
                {JSON.stringify(selectedOrder, null, 2)}
              </pre>
            </div>
          ) : (
            <p className="text-gray-500">No details available</p>
          )}
        </div>
      </Modal>
    </div>
  );
}