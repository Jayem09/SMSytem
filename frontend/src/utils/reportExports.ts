import * as XLSX from 'xlsx';

import { getCollectedTotal } from '../pages/dailyReportUtils';
import { saveWorkbook } from './excelFile';
import {
  formatPaymentMethodLabel,
  getOrderCustomerName,
  getResolvedAmountPaid,
  getResolvedBalanceDue,
  getResolvedPaymentStatus,
  type DateFilter,
  type FilterableOrder,
  type OrdersSortOption,
  type PaymentStatusFilter,
} from '../pages/ordersFilterUtils';

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

export interface DailySummaryExportData {
  date: string;
  advisor_performance: AdvisorPerformance[];
  category_sales: CategorySale[];
  payment_summary: PaymentSummary[];
  account_receivables: number;
  total_sales: number;
}

export interface ExportableOrder extends FilterableOrder {
  id: number;
  guest_phone?: string;
}

export interface OrdersExportFilters {
  paymentStatusFilter: PaymentStatusFilter;
  paymentMethodFilter: string;
  dateFilter: DateFilter;
  selectedDate: string;
  sortOption: OrdersSortOption;
}

export interface OfftakeReportRow {
  order_id: number;
  invoice_no: string;
  invoice_date: string;
  customer_name: string;
  branch_name: string;
  service_advisor: string;
  payment_status: string;
  total_amount: number;
  amount_paid: number;
  balance_due: number;
  item_summary: string;
  quantity_total: number;
}

export interface OfftakeExportFilters {
  startDate: string;
  endDate: string;
  customer: string;
  invoiceNo: string;
  itemName: string;
  branchLabel: string;
  paymentStatus: string;
  serviceAdvisor: string;
}

const PAYMENT_METHOD_LABELS = [
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
] as const;

function formatDateTime(value: string) {
  return new Date(value).toLocaleString();
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

function getPaymentMethodTotal(paymentSummary: PaymentSummary[], key: string) {
  return paymentSummary.find((payment) => payment.method.toLowerCase() === key.toLowerCase())?.total || 0;
}

function getPaymentStatusFilterLabel(paymentStatusFilter: PaymentStatusFilter) {
  const labels: Record<PaymentStatusFilter, string> = {
    all: 'All Payment Statuses',
    receivable: 'Receivables Only',
    paid: 'Paid',
    partial: 'Partial',
    unpaid: 'Unpaid',
  };

  return labels[paymentStatusFilter];
}

function getDateFilterLabel(dateFilter: DateFilter) {
  const labels: Record<DateFilter, string> = {
    all: 'All Dates',
    today: 'Today',
    this_week: 'This Week',
    this_month: 'This Month',
    specific_day: 'Specific Day',
  };

  return labels[dateFilter];
}

function getSortOptionLabel(sortOption: OrdersSortOption) {
  const labels: Record<OrdersSortOption, string> = {
    date_desc: 'Date: Newest First',
    date_asc: 'Date: Oldest First',
    balance_desc: 'Balance Due: Highest First',
    balance_asc: 'Balance Due: Lowest First',
    total_desc: 'Total Amount: Highest First',
    total_asc: 'Total Amount: Lowest First',
    customer_asc: 'Customer: A to Z',
  };

  return labels[sortOption];
}

function appendSheet(workbook: XLSX.WorkBook, rows: Record<string, string | number>[], name: string) {
  const safeRows = rows.length > 0 ? rows : [{ Note: 'No data available' }];
  const sheet = XLSX.utils.json_to_sheet(safeRows);
  XLSX.utils.book_append_sheet(workbook, sheet, name);
}

export function buildDailySummaryOverviewRows(summary: DailySummaryExportData) {
  return [{
    'Report Date': summary.date,
    'Total Sales': summary.total_sales,
    'Items Sold': summary.advisor_performance.reduce((sum, advisor) => sum + advisor.tires_sold, 0),
    'Good as Cash': getCollectedTotal(summary.total_sales, summary.account_receivables),
    'Receivables': summary.account_receivables,
  }];
}

export function buildDailySummaryAdvisorRows(summary: DailySummaryExportData) {
  return summary.advisor_performance.map((advisor, index) => ({
    'Rank': index + 1,
    'Salesperson': advisor.advisor_name?.trim() || 'Unassigned',
    'Qty Sold': advisor.tires_sold,
  }));
}

export function buildDailySummaryCategoryRows(summary: DailySummaryExportData) {
  return summary.category_sales.map((category) => ({
    'Category': category.category,
    'Total Sales': category.total_sales,
  }));
}

export function buildDailySummaryPaymentRows(summary: DailySummaryExportData) {
  const rows = PAYMENT_METHOD_LABELS.map((paymentMethod) => ({
    'Payment Method': paymentMethod.label,
    'Collected Amount': getPaymentMethodTotal(summary.payment_summary, paymentMethod.key),
  }));

  rows.push(
    { 'Payment Method': 'Total Collected', 'Collected Amount': getCollectedTotal(summary.total_sales, summary.account_receivables) },
    { 'Payment Method': 'Receivables', 'Collected Amount': summary.account_receivables },
  );

  return rows;
}

export function buildOrdersExportSummaryRows(orders: ExportableOrder[], filters: OrdersExportFilters) {
  return [{
    'Exported At': new Date().toLocaleString(),
    'Payment Status Filter': getPaymentStatusFilterLabel(filters.paymentStatusFilter),
    'Payment Method Filter': filters.paymentMethodFilter === 'all' ? 'All Methods' : formatPaymentMethodLabel(filters.paymentMethodFilter),
    'Date Filter': filters.dateFilter === 'specific_day'
      ? `${getDateFilterLabel(filters.dateFilter)} (${filters.selectedDate})`
      : getDateFilterLabel(filters.dateFilter),
    'Sort By': getSortOptionLabel(filters.sortOption),
    'Order Count': orders.length,
    'Total Amount': orders.reduce((sum, order) => sum + (order.total_amount ?? 0), 0),
    'Total Paid': orders.reduce((sum, order) => sum + getResolvedAmountPaid(order), 0),
    'Total Balance Due': orders.reduce((sum, order) => sum + getResolvedBalanceDue(order), 0),
  }];
}

export function buildOrdersExportRows(orders: ExportableOrder[]) {
  return orders.map((order) => ({
    'Order #': order.id,
    'Date': formatDate(order.created_at),
    'Date & Time': formatDateTime(order.created_at),
    'Customer': getOrderCustomerName(order),
    'Phone': order.customer?.phone || order.guest_phone || '',
    'Status': order.status,
    'Payment Method': formatPaymentMethodLabel(order.payment_method),
    'Payment Status': getResolvedPaymentStatus(order),
    'Total Amount': order.total_amount,
    'Amount Paid': getResolvedAmountPaid(order),
    'Balance Due': getResolvedBalanceDue(order),
  }));
}

export async function exportDailySummaryToExcel(summary: DailySummaryExportData) {
  const workbook = XLSX.utils.book_new();

  appendSheet(workbook, buildDailySummaryOverviewRows(summary), 'Overview');
  appendSheet(workbook, buildDailySummaryAdvisorRows(summary), 'Salespersons');
  appendSheet(workbook, buildDailySummaryCategoryRows(summary), 'Categories');
  appendSheet(workbook, buildDailySummaryPaymentRows(summary), 'Payments');

  return saveWorkbook(workbook, `daily-summary-${summary.date}.xlsx`);
}

export async function exportOrdersToExcel(orders: ExportableOrder[], filters: OrdersExportFilters) {
  const workbook = XLSX.utils.book_new();
  const workbookBaseName = filters.paymentStatusFilter === 'receivable' ? 'receivables' : 'orders';
  const fileDate = filters.dateFilter === 'specific_day' && filters.selectedDate ? filters.selectedDate : new Date().toISOString().slice(0, 10);

  appendSheet(workbook, buildOrdersExportSummaryRows(orders, filters), 'Summary');
  appendSheet(workbook, buildOrdersExportRows(orders), filters.paymentStatusFilter === 'receivable' ? 'Receivables' : 'Orders');

  return saveWorkbook(workbook, `${workbookBaseName}-${fileDate}.xlsx`);
}

export function buildOfftakeExportSummaryRows(rows: OfftakeReportRow[], filters: OfftakeExportFilters) {
  const totalAmount = rows.reduce((sum, row) => sum + row.total_amount, 0);
  const totalPaid = rows.reduce((sum, row) => sum + row.amount_paid, 0);
  const totalBalance = rows.reduce((sum, row) => sum + row.balance_due, 0);

  return [{
    'Exported At': new Date().toLocaleString(),
    'Date Range': `${filters.startDate} to ${filters.endDate}`,
    'Branch': filters.branchLabel || 'All Branches',
    'Customer': filters.customer || 'All',
    'Invoice #': filters.invoiceNo || 'All',
    'Item': filters.itemName || 'All',
    'Payment Status': filters.paymentStatus || 'All',
    'Salesperson': filters.serviceAdvisor || 'All',
    'Invoice Count': rows.length,
    'Total Amount': totalAmount,
    'Total Paid': totalPaid,
    'Total Balance Due': totalBalance,
  }];
}

export function buildOfftakeExportRows(rows: OfftakeReportRow[]) {
  return rows.map((row) => ({
    'Invoice #': row.invoice_no,
    'Date': row.invoice_date,
    'Customer': row.customer_name,
    'Branch': row.branch_name,
    'Salesperson': row.service_advisor,
    'Payment Status': row.payment_status,
    'Total Amount': row.total_amount,
    'Amount Paid': row.amount_paid,
    'Balance Due': row.balance_due,
    'Items': row.item_summary,
    'Quantity Total': row.quantity_total,
  }));
}

export async function exportOfftakeToExcel(rows: OfftakeReportRow[], filters: OfftakeExportFilters) {
  const workbook = XLSX.utils.book_new();
  const fileDate = filters.endDate || new Date().toISOString().slice(0, 10);

  // Add Details sheet first (default view)
  appendSheet(workbook, buildOfftakeExportRows(rows), 'Details');
  // Add Summary sheet second
  appendSheet(workbook, buildOfftakeExportSummaryRows(rows, filters), 'Summary');

  return saveWorkbook(workbook, `offtake-${fileDate}.xlsx`);
}
