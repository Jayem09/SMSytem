interface PaymentSummary {
  method: string;
  total: number;
}

export function getPaymentValue(paymentSummary: PaymentSummary[], key: string) {
  return paymentSummary.find((payment) => payment.method.toLowerCase() === key.toLowerCase())?.total || 0;
}

export function getCollectedTotal(totalSales: number, accountReceivables: number) {
  return Math.max(totalSales - accountReceivables, 0);
}

export function formatCurrency(value: number) {
  return `₱${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}
