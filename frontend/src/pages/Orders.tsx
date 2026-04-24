import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/axios';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { useAuth } from '../hooks/useAuth';
import { Printer, Eye, Trash2, CheckCircle2, FilterX, FileSpreadsheet } from 'lucide-react';
import { printReceipt } from '../components/Receipt';
import { printDeliveryReceipt } from '../components/DeliveryReceipt';
import { getIsOfflineMode } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import offlineStorage, { type LocalOrder } from '../services/offlineStorage';
import {
  DATE_FILTER_VALUES,
  ORDER_DATE_INPUT_FORMAT,
  PAYMENT_STATUS_FILTER_VALUES,
  SORT_OPTION_VALUES,
  formatCurrency,
  formatPaymentMethodLabel,
  getOrderCustomerName,
  getResolvedAmountPaid,
  getResolvedBalanceDue,
  getResolvedPaymentStatus,
  isDeferredPaymentMethod,
  matchesDateFilter,
  matchesPaymentMethodFilter,
  matchesPaymentStatusFilter,
  sortOrders,
  type DateFilter,
  type OrdersSortOption,
  type PaymentStatusFilter,
} from './ordersFilterUtils';
import { exportOrdersToExcel } from '../utils/reportExports';

interface Customer { id: number; name: string; phone?: string; }
interface Product { id: number; name: string; price: number; branch_stock: number; stock?: number; is_service?: boolean; }
interface OrderItem {
  id: number;
  product_id: number;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
  product_name?: string;
}
interface Order {
  id: number;
  customer_id?: number | null;
  guest_name?: string;
  guest_phone?: string;
  total_amount: number;
  amount_paid?: number;
  balance_due?: number;
  discount_amount: number;
  status: string;
  payment_method: string;
  payment_status?: 'paid' | 'partial' | 'unpaid';
  receipt_type: 'SI' | 'DR';
  tin: string;
  business_address: string;
  withholding_tax_rate: number;
  created_at: string;
  customer?: Customer;
  items?: OrderItem[];
}

// Local offline item shape from parsed JSON
interface RawOfflineItem {
  id?: number;
  product_id?: number;
  product_name?: string;
  quantity?: number;
  unit_price?: number;
  [key: string]: unknown;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  confirmed: 'bg-blue-100 text-blue-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

const paymentStatusColors: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  partial: 'bg-amber-100 text-amber-800',
  unpaid: 'bg-red-100 text-red-800',
};

const PAYMENT_METHOD_OPTIONS = [
  { value: 'all', label: 'All Methods' },
  { value: 'cash', label: 'Cash' },
  { value: 'gcash', label: 'GCash' },
  { value: 'card', label: 'Credit Card' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'dated_check', label: 'Dated Check' },
  { value: 'post_dated_check', label: 'Post-Dated Check' },
  { value: 'claimed_downpayment', label: 'Claimed Downpayment' },
  { value: 'goodyear_voucher', label: 'Goodyear Voucher' },
  { value: 'ewt', label: 'EWT' },
  { value: 'trade_in', label: 'Trade In' },
];

const PAYMENT_STATUS_OPTIONS: { value: PaymentStatusFilter; label: string }[] = [
  { value: 'all', label: 'All Payment Statuses' },
  { value: 'receivable', label: 'Receivables Only' },
  { value: 'paid', label: 'Paid' },
  { value: 'partial', label: 'Partial' },
  { value: 'unpaid', label: 'Unpaid' },
];

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: 'all', label: 'All Dates' },
  { value: 'today', label: 'Today' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'specific_day', label: 'Specific Day' },
];

const SORT_OPTIONS: { value: OrdersSortOption; label: string }[] = [
  { value: 'date_desc', label: 'Date: Newest First' },
  { value: 'date_asc', label: 'Date: Oldest First' },
  { value: 'balance_desc', label: 'Balance Due: Highest First' },
  { value: 'balance_asc', label: 'Balance Due: Lowest First' },
  { value: 'total_desc', label: 'Total Amount: Highest First' },
  { value: 'total_asc', label: 'Total Amount: Lowest First' },
  { value: 'customer_asc', label: 'Customer: A to Z' },
];

function parseFilterOption<T extends readonly string[]>(value: string | null, allowedValues: T, fallback: T[number]): T[number] {
  if (value && allowedValues.includes(value as T[number])) {
    return value as T[number];
  }

  return fallback;
}

export default function Orders() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'purchasing' || user?.role === 'purchaser';
  const canCompletePending = user?.role !== 'super_admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemsModalOpen, setItemsModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const paymentStatusFilter = parseFilterOption(searchParams.get('payment_status'), PAYMENT_STATUS_FILTER_VALUES, 'all');
  const paymentMethodFilter = searchParams.get('payment_method') || 'all';
  const dateFilter = parseFilterOption(searchParams.get('date_filter'), DATE_FILTER_VALUES, 'all');
  const selectedDate = searchParams.get('date') || new Date().toLocaleDateString(ORDER_DATE_INPUT_FORMAT);
  const sortOption = parseFilterOption(searchParams.get('sort'), SORT_OPTION_VALUES, 'date_desc');

  const updateFilters = (updates: Record<string, string | null>) => {
    const nextSearchParams = new URLSearchParams(searchParams);

    Object.entries(updates).forEach(([key, value]) => {
      if (!value) {
        nextSearchParams.delete(key);
      } else {
        nextSearchParams.set(key, value);
      }
    });

    setSearchParams(nextSearchParams, { replace: true });
  };

  const filteredOrders = useMemo(() => {
    const nextOrders = orders.filter((order) => (
      matchesPaymentStatusFilter(order, paymentStatusFilter)
      && matchesPaymentMethodFilter(order, paymentMethodFilter)
      && matchesDateFilter(order, dateFilter, selectedDate)
    ));

    return sortOrders(nextOrders, sortOption);
  }, [orders, paymentStatusFilter, paymentMethodFilter, dateFilter, selectedDate, sortOption]);

  const filteredReceivableTotal = useMemo(() => (
    filteredOrders.reduce((sum, order) => sum + getResolvedBalanceDue(order), 0)
  ), [filteredOrders]);

  const hasActiveFilters = paymentStatusFilter !== 'all'
    || paymentMethodFilter !== 'all'
    || dateFilter !== 'all'
    || sortOption !== 'date_desc';

  // Fetch orders when component mounts or when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      const fetch = async () => {
        // If offline, load from localStorage cache (only unsynced orders!)
        if (getIsOfflineMode()) {
          const allCached = offlineStorage.getOrders();
          // Only show unsynced orders when offline
          const cached = allCached.filter(o => !o.synced);
          console.log('[Orders] Unsynced offline orders:', cached);
          
          // Transform to match Order interface (totalAmount -> total_amount)
          const transformed = (cached || []).map((o: LocalOrder) => {
            // Parse items and add computed fields
            let items: RawOfflineItem[] = [];
            try {
              items = o.items ? JSON.parse(o.items) : [];
              // Add computed fields for display
              items = items.map((item, idx) => ({
                ...item,
                id: item.id || idx,
                product: { name: item.product_name || `Product #${item.product_id}` },
                unit_price: item.unit_price || 0,
                subtotal: (item.quantity || 0) * (item.unit_price || 0),
              }));
            } catch (e) {
              console.error('[Orders] Failed to parse items:', e);
            }
            
            return {
              ...o,
              id: o.id || Date.now(),
              total_amount: o.totalAmount || 0,
              amount_paid: o.amountPaid || 0,
              balance_due: o.balanceDue || 0,
              discount_amount: o.discountAmount || 0,
              created_at: o.createdAt || new Date().toISOString(),
              payment_method: o.paymentMethod || 'cash',
              payment_status: o.paymentStatus || 'unpaid',
              receipt_type: o.receiptType || 'SI',
              tin: o.tin || '',
              business_address: o.businessAddress || '',
              withholding_tax_rate: o.withholdingTaxRate || 0,
              customer: o.customerName ? { name: o.customerName, phone: o.customerPhone } : null,
              guest_name: o.guestName || '',
              guest_phone: o.guestPhone || '',
              service_advisor_name: o.serviceAdvisorName || '',
              reward_id: o.rewardId || null,
              reward_points: o.rewardPoints || 0,
              items,
            };
          });
          console.log('[Orders] Transformed orders:', transformed);
          setOrders(transformed);
          setLoading(false);
          return;
        }
        
        setLoading(true);
        console.log('[Orders] Fetching orders from API...');
        try {
          const res = await api.get('/api/orders');
          console.log('[Orders] API response:', res.data);
          console.log('[Orders] Orders array:', res.data.orders);
          setOrders(res.data.orders || []);
        } catch (err: unknown) {
          console.error('[Orders] Failed to fetch orders:', err);
          const axiosError = err as { response?: { data?: unknown } };
          console.error('[Orders] Response data:', axiosError.response?.data);
        } finally {
          setLoading(false);
        }
      };
      fetch();
    }
  }, [isAuthenticated]);

  // Listen for sync completion to refetch orders
  useEffect(() => {
    const handleSyncComplete = () => {
      console.log('[Orders] Sync completed, refetching...');
      fetchOrders();
    };
    window.addEventListener('sync_completed', handleSyncComplete);
    return () => window.removeEventListener('sync_completed', handleSyncComplete);
  }, [isAuthenticated]);

  // Fetch orders function for refresh after delete/complete
  const fetchOrders = async () => {
    if (getIsOfflineMode()) {
      const allCached = offlineStorage.getOrders();
      const cached = allCached.filter(o => !o.synced);
        const transformed = (cached || []).map((o: LocalOrder) => {
          let items: RawOfflineItem[] = [];
          try {
            items = o.items ? JSON.parse(o.items) : [];
            items = items.map((item, idx) => ({
            ...item,
            id: item.id || idx,
            product: { name: item.product_name || `Product #${item.product_id}` },
            unit_price: item.unit_price || 0,
            subtotal: (item.quantity || 0) * (item.unit_price || 0),
          }));
        } catch (e) {
          console.error('[Orders] Failed to parse items:', e);
        }
        return {
          ...o,
          id: o.id || Date.now(),
          total_amount: o.totalAmount || 0,
          amount_paid: o.amountPaid || 0,
          balance_due: o.balanceDue || 0,
          discount_amount: o.discountAmount || 0,
          created_at: o.createdAt || new Date().toISOString(),
          payment_method: o.paymentMethod || 'cash',
          payment_status: o.paymentStatus || 'unpaid',
          receipt_type: o.receiptType || 'SI',
          tin: o.tin || '',
          business_address: o.businessAddress || '',
          withholding_tax_rate: o.withholdingTaxRate || 0,
          customer: o.customerName ? { name: o.customerName, phone: o.customerPhone } : null,
          guest_name: o.guestName || '',
          guest_phone: o.guestPhone || '',
          service_advisor_name: o.serviceAdvisorName || '',
          reward_id: o.rewardId || null,
          reward_points: o.rewardPoints || 0,
          items,
        };
      });
      setOrders(transformed);
      return;
    }
    setLoading(true);
    console.log('[Orders] Fetching orders from API...');
    try {
      const res = await api.get('/api/orders');
      console.log('[Orders] API response:', res.data);
      console.log('[Orders] Orders array:', res.data.orders);
      setOrders(res.data.orders || []);
    } catch (err: unknown) {
      console.error('[Orders] Failed to fetch orders:', err);
      const axiosError = err as { response?: { data?: unknown } };
      console.error('[Orders] Response data:', axiosError.response?.data);
    } finally {
      setLoading(false);
    }
  };


  const handleDelete = async (order: Order) => {
    if (!confirm(`Delete order #${order.id}?`)) return;
    try {
      await api.delete(`/api/orders/${order.id}`);
      fetchOrders();
    } catch {
      alert('Failed to delete order');
    }
  };

  const handleCompletePending = async (order: Order) => {
    if (!confirm(`Complete Pending Order #${order.id}? This will process the payment and deduct stock.`)) return;

    const defaultAmountPaid = getResolvedAmountPaid(order) > 0
      ? getResolvedAmountPaid(order)
      : isDeferredPaymentMethod(order.payment_method)
        ? 0
        : (order.total_amount ?? 0);

    const rawAmountPaid = window.prompt(
      `Enter amount paid for Order #${order.id}. Leave blank to keep the default payment handling.`,
      defaultAmountPaid.toFixed(2),
    );

    if (rawAmountPaid === null) return;

    const trimmedAmountPaid = rawAmountPaid.trim();
    const payload: { status: 'completed'; amount_paid?: number } = { status: 'completed' };

    if (trimmedAmountPaid !== '') {
      const parsedAmountPaid = Number(trimmedAmountPaid);

      if (!Number.isFinite(parsedAmountPaid) || parsedAmountPaid < 0) {
        alert('Amount paid must be a valid number greater than or equal to 0.');
        return;
      }

      payload.amount_paid = parsedAmountPaid;
    }

    try {
      await api.patch(`/api/orders/${order.id}/status`, payload);
      fetchOrders();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { details?: string } }; message?: string };
      alert(`Failed to complete order: ${e.response?.data?.details || e.message}`);
    }
  };

  const handlePrint = async (order: Order) => {
    console.log('[Orders] Printing order:', order);
    try {
      const orderForReceipt = {
        ...order,
        items: (order.items || []).map((item: OrderItem) => ({
          ...item,
          unit_price: item.unit_price ?? item.price ?? 0,
          subtotal: item.subtotal ?? ((item.quantity || 0) * (item.unit_price ?? item.price ?? 0)),
          product: item.product || { name: `Product #${item.product_id}` },
        })),
      };

      if (order.receipt_type === 'SI') {
        await printReceipt(orderForReceipt, order.tin || '', order.business_address || '', order.withholding_tax_rate || 0);
      } else {
        await printDeliveryReceipt(orderForReceipt, order.tin || '', order.business_address || '', order.withholding_tax_rate || 0);
      }
    } catch (error) {
      console.error('[Orders] Print failed:', error);
      alert('Printing failed. Please try again.');
    }
  };

  const handleExportExcel = async () => {
    if (filteredOrders.length === 0) {
      showToast('No orders match the current filters.', 'info');
      return;
    }

    try {
      const savedPath = await exportOrdersToExcel(filteredOrders, {
        paymentStatusFilter,
        paymentMethodFilter,
        dateFilter,
        selectedDate,
        sortOption,
      });
      if (typeof savedPath === 'string' && '__TAURI_INTERNALS__' in window) {
        showToast(`Excel exported to: ${savedPath}`, 'success');
      } else {
        showToast('Excel download started.', 'success');
      }
    } catch (error) {
      console.error('[Orders] Excel export failed:', error);
      showToast('Failed to export orders to Excel.', 'error');
    }
  };

  return (
    <div className="p-6 mx-auto">
      <div className="flex flex-col gap-6 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Orders</h1>
          <p className="text-gray-500 mt-1">Manage sales, payments, receivables, and customer receipts.</p>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Payment Status</label>
              <select
                value={paymentStatusFilter}
                onChange={(event) => updateFilters({ payment_status: event.target.value === 'all' ? null : event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PAYMENT_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Payment Method</label>
              <select
                value={paymentMethodFilter}
                onChange={(event) => updateFilters({ payment_method: event.target.value === 'all' ? null : event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {PAYMENT_METHOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Date Filter</label>
              <select
                value={dateFilter}
                onChange={(event) => updateFilters({
                  date_filter: event.target.value === 'all' ? null : event.target.value,
                  date: event.target.value === 'specific_day' ? selectedDate : null,
                })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DATE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Sort By</label>
              <select
                value={sortOption}
                onChange={(event) => updateFilters({ sort: event.target.value === 'date_desc' ? null : event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          {dateFilter === 'specific_day' && (
            <div className="mt-3 max-w-xs">
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-gray-500">Selected Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(event) => updateFilters({ date: event.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          )}

          <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1 text-sm text-gray-500">
              <span>Showing {filteredOrders.length} of {orders.length} orders</span>
              {paymentStatusFilter === 'receivable' && (
                <span className="font-medium text-amber-600">
                  Outstanding balance in view: {formatCurrency(filteredReceivableTotal)}
                </span>
              )}
            </div>

            <div className="flex flex-col gap-3 md:flex-row">
              <button
                type="button"
                onClick={handleExportExcel}
                disabled={loading || filteredOrders.length === 0}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-5 text-sm font-semibold text-emerald-700 transition-colors hover:border-emerald-300 hover:bg-emerald-100 hover:text-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              >
                <FileSpreadsheet className="h-4 w-4" />
                {paymentStatusFilter === 'receivable' ? 'Export Receivables' : 'Export Excel'}
              </button>

              <button
                type="button"
                onClick={() => setSearchParams(new URLSearchParams(), { replace: true })}
                disabled={!hasActiveFilters}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-5 text-sm font-semibold text-gray-700 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-900 disabled:cursor-not-allowed disabled:opacity-50 md:w-auto"
              >
                <FilterX className="h-4 w-4" />
                Clear Filters
              </button>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        columns={[
          { key: 'id', label: 'Order #', render: (o) => `#${o?.id || 'N/A'}` },
          { key: 'customer', label: 'Customer', render: (o) => getOrderCustomerName(o) },
          { key: 'total_amount', label: 'Total', render: (o) => formatCurrency(o?.total_amount) },
          { key: 'amount_paid', label: 'Paid', render: (o) => formatCurrency(getResolvedAmountPaid(o)) },
          { key: 'balance_due', label: 'Balance', render: (o) => (
            <span className={getResolvedBalanceDue(o) > 0 ? 'font-semibold text-amber-600' : 'text-gray-500'}>
              {formatCurrency(getResolvedBalanceDue(o))}
            </span>
          ) },
          { key: 'status', label: 'Status', render: (o) => (
            <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[o?.status] || 'bg-gray-100 text-gray-800'}`}>
              {o?.status || 'unknown'}
            </span>
          )},
          { key: 'payment_method', label: 'Payment', render: (o) => (
            <div className="space-y-1">
              <div>{formatPaymentMethodLabel(o?.payment_method)}</div>
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${paymentStatusColors[getResolvedPaymentStatus(o)] || 'bg-gray-100 text-gray-800'}`}>
                {getResolvedPaymentStatus(o)}
              </span>
            </div>
          ) },
          { key: 'created_at', label: 'Date', render: (o) => o?.created_at ? new Date(o.created_at).toLocaleDateString() : 'N/A' },
        ]}
        data={filteredOrders}
        loading={loading}
        emptyMessage="No orders matched the current filters"
        actions={(order) => (
          <div className="flex items-center gap-3 justify-end">
            <button
              onClick={() => { setSelectedOrder(order); setItemsModalOpen(true); }}
              className="p-2 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
            <button
              onClick={() => handlePrint(order)}
              className="p-2 text-indigo-500 hover:text-indigo-700 hover:bg-indigo-50 rounded-xl transition-colors cursor-pointer"
              title={`Print ${order.receipt_type === 'SI' ? 'Sales Invoice' : 'Delivery Receipt'}`}
            >
              <Printer className="w-4 h-4" />
            </button>

            {order.status === 'pending' && canCompletePending && (
              <button
                onClick={() => handleCompletePending(order)}
                className="p-2 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer"
                title="Complete & Deduct Stock"
              >
                <CheckCircle2 className="w-4 h-4" />
              </button>
            )}

            {isAdmin && (
              <button 
                onClick={() => handleDelete(order)} 
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                title="Delete Order"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        )}
      />

      {}
      <Modal open={itemsModalOpen} onClose={() => setItemsModalOpen(false)} title={`Order #${selectedOrder?.id || ''} Details`} maxWidth="max-w-3xl">
        {selectedOrder && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Customer</p>
                <p className="text-sm font-bold text-gray-900">{selectedOrder.customer?.name || selectedOrder.guest_name || 'Walk-In'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Date</p>
                <p className="text-sm font-bold text-gray-900">{new Date(selectedOrder.created_at).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Type</p>
                <p className="text-sm font-bold text-gray-900">{selectedOrder.receipt_type === 'SI' ? 'Sales Invoice' : 'Delivery Receipt'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Status</p>
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase tracking-widest ${
                  selectedOrder.status === 'completed' ? 'bg-green-100 text-green-700' : 
                  selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-200 text-gray-700'
                }`}>
                  {selectedOrder.status}
                </span>
              </div>
            </div>

            <div className="border border-gray-100 rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr className="text-left">
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Product</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-center">Qty</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Unit Price</th>
                    <th className="py-3 px-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {selectedOrder.items?.map((item: OrderItem, idx: number) => (
                    <tr key={item?.id || idx} className="hover:bg-gray-50/50 transition-colors">
                      <td className="py-4 px-4 text-gray-900 font-bold">{item?.product?.name || item?.product_name || `Product #${item?.product_id || 'N/A'}`}</td>
                      <td className="py-4 px-4 text-gray-600 text-center font-medium">{item?.quantity || 0}</td>
                      <td className="py-4 px-4 text-gray-600 text-right">₱{(item?.unit_price ?? 0).toLocaleString()}</td>
                      <td className="py-4 px-4 text-gray-900 font-black text-right">₱{(item?.subtotal ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end pt-2">
              <div className="w-64 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Subtotal</span>
                  <span className="text-gray-900 font-bold">
                    {formatCurrency(selectedOrder.items?.reduce((sum: number, item: OrderItem) => sum + (item?.subtotal ?? 0), 0))}
                  </span>
                </div>
                {(selectedOrder?.discount_amount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-red-600">
                    <span className="font-medium">Discount</span>
                    <span className="font-bold">-{formatCurrency(selectedOrder?.discount_amount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Amount Paid</span>
                  <span className="text-gray-900 font-bold">{formatCurrency(getResolvedAmountPaid(selectedOrder))}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Balance Due</span>
                  <span className={`font-bold ${getResolvedBalanceDue(selectedOrder) > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                    {formatCurrency(getResolvedBalanceDue(selectedOrder))}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-medium">Payment Status</span>
                  <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${paymentStatusColors[getResolvedPaymentStatus(selectedOrder)] || 'bg-gray-100 text-gray-800'}`}>
                    {getResolvedPaymentStatus(selectedOrder)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-3 border-t border-gray-100">
                  <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Total Amount</span>
                  <span className="text-2xl font-black text-gray-900 tracking-tighter">{formatCurrency(selectedOrder?.total_amount)}</span>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-gray-100 flex justify-end">
               <button
                 onClick={() => handlePrint(selectedOrder)}
                 className="px-6 py-3 bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-gray-800 transition-all flex items-center gap-2 cursor-pointer"
               >
                 <Printer className="w-4 h-4" />
                 Print Receipt
               </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
