import { describe, expect, it } from 'vitest';

import {
  formatPaymentMethodLabel,
  getResolvedBalanceDue,
  getResolvedPaymentStatus,
  matchesDateFilter,
  matchesPaymentMethodFilter,
  matchesPaymentStatusFilter,
  sortOrders,
  type FilterableOrder,
} from './ordersFilterUtils';

function buildOrder(overrides: Partial<FilterableOrder> = {}): FilterableOrder {
  return {
    total_amount: 1000,
    amount_paid: 1000,
    balance_due: 0,
    payment_method: 'cash',
    payment_status: 'paid',
    status: 'completed',
    created_at: '2026-04-24T10:00:00Z',
    customer: { name: 'Alice' },
    guest_name: '',
    ...overrides,
  };
}

describe('ordersFilterUtils', () => {
  it('derives balance due and payment status from amounts', () => {
    const order = buildOrder({ amount_paid: 250, balance_due: undefined, payment_status: undefined });

    expect(getResolvedBalanceDue(order)).toBe(750);
    expect(getResolvedPaymentStatus(order)).toBe('partial');
  });

  it('matches receivable filter only for completed orders with balance due', () => {
    const completedReceivable = buildOrder({ amount_paid: 400, balance_due: 600, payment_status: 'partial', status: 'completed' });
    const pendingBalance = buildOrder({ amount_paid: 0, balance_due: 1000, payment_status: 'unpaid', status: 'pending' });

    expect(matchesPaymentStatusFilter(completedReceivable, 'receivable')).toBe(true);
    expect(matchesPaymentStatusFilter(pendingBalance, 'receivable')).toBe(false);
  });

  it('matches payment method filter exactly', () => {
    const order = buildOrder({ payment_method: 'post_dated_check' });

    expect(matchesPaymentMethodFilter(order, 'post_dated_check')).toBe(true);
    expect(matchesPaymentMethodFilter(order, 'cash')).toBe(false);
  });

  it('matches specific day using local date formatting', () => {
    const order = buildOrder({ created_at: '2026-04-24T12:00:00' });

    expect(matchesDateFilter(order, 'specific_day', '2026-04-24', new Date('2026-04-25T00:00:00Z'))).toBe(true);
    expect(matchesDateFilter(order, 'specific_day', '2026-04-23', new Date('2026-04-25T00:00:00Z'))).toBe(false);
  });

  it('sorts orders by balance due descending', () => {
    const sorted = sortOrders([
      buildOrder({ customer: { name: 'Zero' }, amount_paid: 1000, balance_due: 0 }),
      buildOrder({ customer: { name: 'High' }, amount_paid: 100, balance_due: 900 }),
      buildOrder({ customer: { name: 'Mid' }, amount_paid: 500, balance_due: 500 }),
    ], 'balance_desc');

    expect(sorted.map((order) => order.customer?.name)).toEqual(['High', 'Mid', 'Zero']);
  });

  it('formats payment method labels for display', () => {
    expect(formatPaymentMethodLabel('post_dated_check')).toBe('Post Dated Check');
    expect(formatPaymentMethodLabel('gcash')).toBe('GCash');
    expect(formatPaymentMethodLabel(undefined)).toBe('N/A');
  });
});
