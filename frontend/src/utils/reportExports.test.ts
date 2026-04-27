import { describe, expect, it, vi } from 'vitest';

import {
  buildDailySummaryOverviewRows,
  buildDailySummaryPaymentRows,
  buildOfftakeExportRows,
  buildOfftakeExportSummaryRows,
  buildOrdersExportRows,
  buildOrdersExportSummaryRows,
  type DailySummaryExportData,
  type ExportableOrder,
  type OfftakeReportRow,
  type OrdersExportFilters,
} from './reportExports';

describe('reportExports', () => {
  it('builds Daily Summary overview rows with collected totals', () => {
    const summary: DailySummaryExportData = {
      date: '2026-04-24',
      advisor_performance: [{ advisor_name: 'Alex', tires_sold: 4 }, { advisor_name: '', tires_sold: 3 }],
      category_sales: [],
      payment_summary: [],
      account_receivables: 6174,
      total_sales: 31956,
    };

    expect(buildDailySummaryOverviewRows(summary)).toEqual([
      {
        'Report Date': '2026-04-24',
        'Total Sales': 31956,
        'Items Sold': 7,
        'Good as Cash': 25782,
        'Receivables': 6174,
      },
    ]);
  });

  it('builds Daily Summary payment rows with totals and receivables', () => {
    const summary: DailySummaryExportData = {
      date: '2026-04-24',
      advisor_performance: [],
      category_sales: [],
      payment_summary: [
        { method: 'cash', total: 21666 },
        { method: 'card', total: 4116 },
      ],
      account_receivables: 6174,
      total_sales: 31956,
    };

    const rows = buildDailySummaryPaymentRows(summary);

    expect(rows.find((row) => row['Payment Method'] === 'Cash')).toEqual({
      'Payment Method': 'Cash',
      'Collected Amount': 21666,
    });
    expect(rows.at(-2)).toEqual({ 'Payment Method': 'Total Collected', 'Collected Amount': 25782 });
    expect(rows.at(-1)).toEqual({ 'Payment Method': 'Receivables', 'Collected Amount': 6174 });
  });

  it('builds export rows for receivable orders using derived payment fields', () => {
    const orders: ExportableOrder[] = [{
      id: 80,
      customer: { name: 'John Mark', phone: '0917' },
      total_amount: 6174,
      amount_paid: 0,
      balance_due: 6174,
      payment_method: 'post_dated_check',
      payment_status: 'unpaid',
      status: 'completed',
      created_at: '2026-04-24T09:30:00',
      guest_name: '',
      guest_phone: '',
    }];

    const row = buildOrdersExportRows(orders)[0];

    expect(row['Order #']).toBe(80);
    expect(row['Customer']).toBe('John Mark');
    expect(row['Payment Method']).toBe('Post Dated Check');
    expect(row['Payment Status']).toBe('unpaid');
    expect(row['Balance Due']).toBe(6174);
  });

  it('builds orders export summary rows with active filters', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-24T10:45:00'));

    const orders: ExportableOrder[] = [{
      id: 80,
      customer: { name: 'John Mark', phone: '0917' },
      total_amount: 6174,
      amount_paid: 0,
      balance_due: 6174,
      payment_method: 'post_dated_check',
      payment_status: 'unpaid',
      status: 'completed',
      created_at: '2026-04-24T09:30:00',
      guest_name: '',
      guest_phone: '',
    }];

    const filters: OrdersExportFilters = {
      paymentStatusFilter: 'receivable',
      paymentMethodFilter: 'post_dated_check',
      dateFilter: 'specific_day',
      selectedDate: '2026-04-24',
      sortOption: 'balance_desc',
    };

    const row = buildOrdersExportSummaryRows(orders, filters)[0];

    expect(row['Payment Status Filter']).toBe('Receivables Only');
    expect(row['Payment Method Filter']).toBe('Post Dated Check');
    expect(row['Date Filter']).toBe('Specific Day (2026-04-24)');
    expect(row['Total Balance Due']).toBe(6174);

    vi.useRealTimers();
  });
});

describe('offtakeReportExports', () => {
  it('builds offtake export summary rows from active filters', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-04-10T15:00:00'));

    const rows: OfftakeReportRow[] = [{
      order_id: 42,
      invoice_no: 'SI-00042',
      invoice_date: '2026-04-10',
      customer_name: 'John Doe',
      branch_name: 'LIPA A',
      service_advisor: 'Mike',
      payment_status: 'paid',
      total_amount: 12500,
      amount_paid: 12500,
      balance_due: 0,
      item_summary: 'Accelera Tire x2, Alignment x1',
      quantity_total: 3,
    }];

    const filters = {
      startDate: '2026-04-05',
      endDate: '2026-04-10',
      customer: 'John',
      invoiceNo: '',
      itemName: 'Accelera',
      branchLabel: 'LIPA A',
      paymentStatus: 'paid',
      serviceAdvisor: 'Mike',
    };

    const summary = buildOfftakeExportSummaryRows(rows, filters)[0];

    expect(summary['Date Range']).toBe('2026-04-05 to 2026-04-10');
    expect(summary['Branch']).toBe('LIPA A');
    expect(summary['Invoice Count']).toBe(1);

    vi.useRealTimers();
  });

  it('builds invoice-level offtake export rows', () => {
    const rows = buildOfftakeExportRows([{
      order_id: 42,
      invoice_no: 'SI-00042',
      invoice_date: '2026-04-10',
      customer_name: 'John Doe',
      branch_name: 'LIPA A',
      service_advisor: 'Mike',
      payment_status: 'paid',
      total_amount: 12500,
      amount_paid: 12500,
      balance_due: 0,
      item_summary: 'Accelera Tire x2, Alignment x1',
      quantity_total: 3,
    }]);

    expect(rows[0]['Invoice #']).toBe('SI-00042');
    expect(rows[0]['Items']).toContain('Accelera Tire x2');
    expect(rows[0]['Quantity Total']).toBe(3);
  });
});
