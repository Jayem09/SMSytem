export const ORDER_DATE_INPUT_FORMAT = 'en-CA';

export const PAYMENT_STATUS_FILTER_VALUES = ['all', 'paid', 'partial', 'unpaid', 'receivable'] as const;
export type PaymentStatusFilter = (typeof PAYMENT_STATUS_FILTER_VALUES)[number];

export const DATE_FILTER_VALUES = ['all', 'today', 'this_week', 'this_month', 'specific_day'] as const;
export type DateFilter = (typeof DATE_FILTER_VALUES)[number];

export const SORT_OPTION_VALUES = ['date_desc', 'date_asc', 'balance_desc', 'balance_asc', 'total_desc', 'total_asc', 'customer_asc'] as const;
export type OrdersSortOption = (typeof SORT_OPTION_VALUES)[number];

export type OrderPaymentStatus = 'paid' | 'partial' | 'unpaid';

export interface FilterableOrder {
  customer?: { name?: string | null } | null;
  guest_name?: string;
  total_amount: number;
  amount_paid?: number;
  balance_due?: number;
  payment_method: string;
  payment_status?: OrderPaymentStatus;
  status: string;
  created_at: string;
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function normalizeDate(date: Date) {
  return startOfDay(date).getTime();
}

function isSameDay(left: Date, right: Date) {
  return normalizeDate(left) === normalizeDate(right);
}

function getStartOfWeek(date: Date) {
  const nextDate = startOfDay(date);
  nextDate.setDate(nextDate.getDate() - nextDate.getDay());
  return nextDate;
}

export function formatCurrency(value: number | undefined) {
  return `₱${(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatPaymentMethodLabel(paymentMethod: string | undefined) {
  if (!paymentMethod) {
    return 'N/A';
  }

  const normalized = paymentMethod.trim().toLowerCase();

  const specialLabels: Record<string, string> = {
    gcash: 'GCash',
    ewt: 'EWT',
  };

  if (specialLabels[normalized]) {
    return specialLabels[normalized];
  }

  return normalized
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

export function isDeferredPaymentMethod(paymentMethod: string | undefined) {
  const normalized = paymentMethod?.trim().toLowerCase() || '';
  return normalized === 'dated_check' || normalized === 'post_dated_check';
}

export function getResolvedAmountPaid(order: FilterableOrder) {
  return order.amount_paid ?? 0;
}

export function getResolvedBalanceDue(order: FilterableOrder) {
  if (typeof order.balance_due === 'number') {
    return order.balance_due;
  }

  return Math.max((order.total_amount ?? 0) - getResolvedAmountPaid(order), 0);
}

export function getResolvedPaymentStatus(order: FilterableOrder): OrderPaymentStatus {
  if (order.payment_status) {
    return order.payment_status;
  }

  const amountPaid = getResolvedAmountPaid(order);
  const balanceDue = getResolvedBalanceDue(order);

  if (balanceDue <= 0) {
    return 'paid';
  }

  if (amountPaid > 0) {
    return 'partial';
  }

  return 'unpaid';
}

export function getOrderCustomerName(order: FilterableOrder) {
  return order.customer?.name || order.guest_name || 'Walk-In';
}

export function getOrderLocalDateValue(createdAt: string) {
  return new Date(createdAt).toLocaleDateString(ORDER_DATE_INPUT_FORMAT);
}

export function matchesPaymentStatusFilter(order: FilterableOrder, paymentStatusFilter: PaymentStatusFilter) {
  if (paymentStatusFilter === 'all') {
    return true;
  }

  if (paymentStatusFilter === 'receivable') {
    return order.status === 'completed' && getResolvedBalanceDue(order) > 0;
  }

  return getResolvedPaymentStatus(order) === paymentStatusFilter;
}

export function matchesPaymentMethodFilter(order: FilterableOrder, paymentMethodFilter: string) {
  if (!paymentMethodFilter || paymentMethodFilter === 'all') {
    return true;
  }

  return order.payment_method === paymentMethodFilter;
}

export function matchesDateFilter(order: FilterableOrder, dateFilter: DateFilter, selectedDate: string, now = new Date()) {
  if (dateFilter === 'all') {
    return true;
  }

  const orderDate = new Date(order.created_at);
  if (Number.isNaN(orderDate.getTime())) {
    return false;
  }

  if (dateFilter === 'specific_day') {
    if (!selectedDate) {
      return true;
    }

    return getOrderLocalDateValue(order.created_at) === selectedDate;
  }

  const today = startOfDay(now);

  if (dateFilter === 'today') {
    return isSameDay(orderDate, today);
  }

  if (dateFilter === 'this_week') {
    return normalizeDate(orderDate) >= normalizeDate(getStartOfWeek(today));
  }

  return orderDate.getFullYear() === today.getFullYear() && orderDate.getMonth() === today.getMonth();
}

export function sortOrders<T extends FilterableOrder>(orders: T[], sortOption: OrdersSortOption) {
  return [...orders].sort((left, right) => {
    switch (sortOption) {
      case 'date_asc':
        return new Date(left.created_at).getTime() - new Date(right.created_at).getTime();
      case 'balance_desc':
        return getResolvedBalanceDue(right) - getResolvedBalanceDue(left);
      case 'balance_asc':
        return getResolvedBalanceDue(left) - getResolvedBalanceDue(right);
      case 'total_desc':
        return (right.total_amount ?? 0) - (left.total_amount ?? 0);
      case 'total_asc':
        return (left.total_amount ?? 0) - (right.total_amount ?? 0);
      case 'customer_asc':
        return getOrderCustomerName(left).localeCompare(getOrderCustomerName(right));
      case 'date_desc':
      default:
        return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
    }
  });
}
