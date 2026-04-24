import { describe, expect, it } from 'vitest';

import { formatCurrency, getCollectedTotal, getPaymentValue } from './dailyReportUtils';

describe('dailyReportUtils', () => {
  it('returns matching payment totals by method', () => {
    const paymentSummary = [
      { method: 'cash', total: 21666 },
      { method: 'card', total: 4116 },
    ];

    expect(getPaymentValue(paymentSummary, 'cash')).toBe(21666);
    expect(getPaymentValue(paymentSummary, 'CARD')).toBe(4116);
    expect(getPaymentValue(paymentSummary, 'gcash')).toBe(0);
  });

  it('calculates collected total by subtracting receivables from sales', () => {
    expect(getCollectedTotal(31956, 6174)).toBe(25782);
    expect(getCollectedTotal(5000, 0)).toBe(5000);
  });

  it('never returns a negative collected total', () => {
    expect(getCollectedTotal(1000, 2000)).toBe(0);
  });

  it('formats currency consistently', () => {
    expect(formatCurrency(25782)).toBe('₱25,782.00');
  });
});
