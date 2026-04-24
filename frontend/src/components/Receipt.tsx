

interface ReceiptOrderItem {
  id: number;
  quantity: number;
  price?: number;
  unit_price?: number;
  subtotal: number;
  product?: { name: string };
}

interface ReceiptOrder {
  id: number;
  total_amount: number;
  discount_amount: number;
  payment_method: string;
  created_at: string;
  guest_name?: string;
  guest_phone?: string;
  customer?: { name: string; phone?: string; address?: string };
  items?: ReceiptOrderItem[];
}

function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function generateReceiptHTML(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const customerName = escapeHtml(order.customer?.name || order.guest_name || 'WALK-IN');
  const custAddress = escapeHtml(businessAddress || order.customer?.address || '');
  const custTin = escapeHtml(tin || '');

  const totalAmount = order.total_amount || 0;
  const discountAmount = order.discount_amount || 0;
  const vatInclusive = totalAmount;
  const vatAmount = vatInclusive / 1.12 * 0.12;
  const netOfVat = vatInclusive - vatAmount;
  const vatableSales = netOfVat;
  const whTaxRate = withholdingTaxRate || 0;
  const whTaxAmount = netOfVat * (whTaxRate / 100);
  const totalAmountDue = totalAmount - whTaxAmount;

  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const items = order.items || [];
  
  // Separate regular items, rewards, and get discount
  const regularItems = items.filter(item => {
    const unitPrice = item.unit_price ?? item.price ?? (item.subtotal && item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    return !(unitPrice === 0 && subtotal === 0); // Not a reward
  });
  
  const rewardItems = items.filter(item => {
    const unitPrice = item.unit_price ?? item.price ?? (item.subtotal && item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    return unitPrice === 0 && subtotal === 0; // Is a reward
  });
  
  // Build rows: regular items first, then reward items, then discount at the end
  let rowIndex = 0;
  let itemRows = '';
  
  // Regular items
  regularItems.forEach((item) => {
    const unitPrice = item.unit_price ?? item.price ?? (item.subtotal && item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    const baseTop = 3.47; 
    const rowHeight = 0.29;
    const topPos = baseTop + (rowIndex * rowHeight);
    itemRows += `
      <div class="col-desc"  style="top: calc(${topPos}in + var(--printer-offset)); left: 1.05in;">${escapeHtml(item.product?.name || '')}</div>
      <div class="col-qty"   style="top: calc(${topPos}in + var(--printer-offset)); left: 4.75in;">${item.quantity}</div>
      <div class="col-price" style="top: calc(${topPos}in + var(--printer-offset)); left: 5.30in;">${fmt(unitPrice)}</div>
      <div class="col-amt"   style="top: calc(${topPos}in + var(--printer-offset)); left: 6.50in;">${fmt(subtotal)}</div>
    `;
    rowIndex++;
  });
  
  // Reward items (FREE)
  rewardItems.forEach((item) => {
    const itemName = `${item.product?.name || ''} (REWARD)`;
    const baseTop = 3.47; 
    const rowHeight = 0.29;
    const topPos = baseTop + (rowIndex * rowHeight);
    itemRows += `
      <div class="col-desc"  style="top: calc(${topPos}in + var(--printer-offset)); left: 1.05in;">${escapeHtml(itemName)}</div>
      <div class="col-qty"   style="top: calc(${topPos}in + var(--printer-offset)); left: 4.75in;">${item.quantity}</div>
      <div class="col-price" style="top: calc(${topPos}in + var(--printer-offset)); left: 5.30in;">FREE</div>
      <div class="col-amt"   style="top: calc(${topPos}in + var(--printer-offset)); left: 6.50in;">FREE</div>
    `;
    rowIndex++;
  });
  
  // Discount at the end
  if (discountAmount > 0) {
    const baseTop = 3.47; 
    const rowHeight = 0.29;
    const topPos = baseTop + (rowIndex * rowHeight);
    itemRows += `
      <div class="col-desc"  style="top: calc(${topPos}in + var(--printer-offset)); left: 1.05in;">DISCOUNT</div>
      <div class="col-qty"   style="top: calc(${topPos}in + var(--printer-offset)); left: 4.75in;">-</div>
      <div class="col-price" style="top: calc(${topPos}in + var(--printer-offset)); left: 5.30in;">-${fmt(discountAmount)}</div>
      <div class="col-amt"   style="top: calc(${topPos}in + var(--printer-offset)); left: 6.50in;">-${fmt(discountAmount)}</div>
    `;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice Preview — Align &amp; Print</title>
      <style>
        .bir-receipt-app { 
          margin: 0; 
          padding: 0; 
          box-sizing: border-box; 
          font-family: 'Courier New', Courier, monospace;
          font-size: 15px;
          color: #000;
          width: 8.27in;
          height: 11.69in;
          position: relative;
          background: white;
          --printer-offset: 0in;
          overflow: hidden;
        }
        .bir-receipt-app * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: 8.27in 11.69in;
          margin: 0;
        }
        @media print {
          html, body {
            margin: 0;
            padding: 0;
            width: 8.27in;
            height: 11.69in;
            background: white;
            overflow: hidden;
          }

          .bir-receipt-app {
            page-break-after: avoid;
          }
        }

        .bir-receipt-app .date-field, .bir-receipt-app .reg-name, .bir-receipt-app .tin-field, .bir-receipt-app .address,
        .bir-receipt-app .items-table, .bir-receipt-app .vatable-sales, .bir-receipt-app .vat-amount-left,
        .bir-receipt-app .zero-rated, .bir-receipt-app .vat-exempt, .bir-receipt-app .total-vat-incl,
        .bir-receipt-app .less-vat, .bir-receipt-app .net-of-vat, .bir-receipt-app .less-discount,
        .bir-receipt-app .add-vat, .bir-receipt-app .less-withholding, .bir-receipt-app .total-due {
          z-index: 1;
        }

        .bir-receipt-app .date-field { position: absolute; top: calc(1.60in + var(--printer-offset));  left: 5.80in;  font-size: 15px; }
        .bir-receipt-app .reg-name   { position: absolute; top: calc(2.15in + var(--printer-offset));  left: 1.90in;  font-size: 15px; }
        .bir-receipt-app .tin-field   { position: absolute; top: calc(2.50in + var(--printer-offset));  left: 1.05in;  font-size: 15px; }
        .bir-receipt-app .address    { position: absolute; top: calc(2.75in + var(--printer-offset));  left: 2.00in;  font-size: 15px; }

        .bir-receipt-app .col-desc, .bir-receipt-app .col-qty, .bir-receipt-app .col-price, .bir-receipt-app .col-amt {
          position: absolute;
          font-size: 15px;
          height: 0.29in; 
          line-height: 0.29in;
          white-space: nowrap;
          overflow: hidden;
        }
        
        .bir-receipt-app .col-desc  { width: 3.2in; text-align: left; }
        .bir-receipt-app .col-qty   { width: 0.5in; text-align: center; }
        .bir-receipt-app .col-price { width: 1.0in; text-align: right; }
        .bir-receipt-app .col-amt   { width: 1.0in; text-align: right; }

        .bir-receipt-app .vatable-sales   { position: absolute; top: calc(7.10in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .bir-receipt-app .vat-amount-left { position: absolute; top: calc(7.35in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .bir-receipt-app .zero-rated      { position: absolute; top: calc(7.65in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .bir-receipt-app .vat-exempt      { position: absolute; top: calc(7.90in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }

        .bir-receipt-app .total-vat-incl  { position: absolute; top: calc(7.10in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .bir-receipt-app .less-vat        { position: absolute; top: calc(7.35in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .bir-receipt-app .net-of-vat      { position: absolute; top: calc(7.65in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .bir-receipt-app .less-discount   { position: absolute; top: calc(7.95in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .bir-receipt-app .add-vat         { position: absolute; top: calc(8.20in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .bir-receipt-app .less-withholding { position: absolute; top: calc(8.45in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .bir-receipt-app .total-due       { position: absolute; top: calc(8.75in + var(--printer-offset)); left: 6.20in; font-size: 15px; font-weight: bold; text-align: right; width: 1.5in; }
      </style>
    </head>
    <body>
      <div class="bir-receipt-app">

      <!-- Customer Info -->
      <div class="date-field">${dateStr}</div>
      <div class="reg-name">${customerName}</div>
      <div class="tin-field">${custTin}</div>
      <div class="address">${custAddress}</div>

      <!-- Items -->
      ${itemRows}

      <!-- Tax Summary — Left Side -->
      <div class="vatable-sales">${fmt(vatableSales)}</div>
      <div class="vat-amount-left">${fmt(vatAmount)}</div>
      <div class="zero-rated">0.00</div>
      <div class="vat-exempt">0.00</div>

      <!-- Tax Summary — Right Side -->
      <div class="total-vat-incl">${fmt(vatInclusive)}</div>
      <div class="less-vat">${fmt(vatAmount)}</div>
      <div class="net-of-vat">${fmt(netOfVat)}</div>
      <div class="less-discount">${discountAmount > 0 ? fmt(discountAmount) : '0.00'}</div>
      <div class="add-vat">${fmt(vatAmount)}</div>
      <div class="less-withholding">${fmt(whTaxAmount)}</div>
      <div class="total-due">${fmt(totalAmountDue)}</div>
      </div>
    </body>
    </html>
  `;

  return html;
}

export async function printReceipt(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number) {
  const htmlContent = generateReceiptHTML(order, tin, businessAddress, withholdingTaxRate);

  let container = document.getElementById('print-area');
  if (!container) {
    container = document.createElement('div');
    container.id = 'print-area';
    document.body.appendChild(container);
  }

  const headContent = htmlContent.match(/<head[^>]*>([\s\S]*)<\/head>/)?.[1] || '';
  const bodyInner = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || htmlContent;

  container.innerHTML = `${headContent}${bodyInner}`;

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(resolve, 200);
      });
    });
  });

  window.print();
}
