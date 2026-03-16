

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

export function generateReceiptHTML(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' });

  
  const customerName = order.customer?.name || order.guest_name || 'WALK-IN';
  const custAddress = businessAddress || order.customer?.address || '';
  const custTin = tin || '';

  
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
  const itemRows = items.map((item, index) => {
    const unitPrice = item.unit_price ?? item.price ?? (item.subtotal && item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    
    
    
    const baseTop = 3.47; 
    const rowHeight = 0.29;
    const topPos = baseTop + (index * rowHeight);

    return `
      <!-- Row ${index + 1} -->
      <div class="col-desc"  style="top: calc(${topPos}in + var(--printer-offset)); left: 1.05in;">${item.product?.name || ''}</div>
      <div class="col-qty"   style="top: calc(${topPos}in + var(--printer-offset)); left: 4.75in;">${item.quantity}</div>
      <div class="col-price" style="top: calc(${topPos}in + var(--printer-offset)); left: 5.30in;">${fmt(unitPrice)}</div>
      <div class="col-amt"   style="top: calc(${topPos}in + var(--printer-offset)); left: 6.50in;">${fmt(subtotal)}</div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice Preview — Align &amp; Print</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: 8.27in 11.69in;
          margin: 0;
        }
        body {
          font-family: 'Courier New', Courier, monospace;
          font-size: 15px;
          color: #000;
          width: 8.27in;
          height: 11.69in;
          position: relative;
          
          --printer-offset: 0in;
        }

        
        @media print {
          
           
          
        }

        
        .date-field, .reg-name, .tin-field, .address,
        .items-table, .vatable-sales, .vat-amount-left,
        .zero-rated, .vat-exempt, .total-vat-incl,
        .less-vat, .net-of-vat, .less-discount,
        .add-vat, .less-withholding, .total-due {
          z-index: 1;
        }

        

        
        .date-field { position: absolute; top: calc(1.60in + var(--printer-offset));  left: 5.80in;  font-size: 15px; }
        .reg-name   { position: absolute; top: calc(2.15in + var(--printer-offset));  left: 1.90in;  font-size: 15px; }
        .tin-field   { position: absolute; top: calc(2.50in + var(--printer-offset));  left: 1.05in;  font-size: 15px; }
        .address    { position: absolute; top: calc(2.75in + var(--printer-offset));  left: 2.00in;  font-size: 15px; }

        
        
        .col-desc, .col-qty, .col-price, .col-amt {
          position: absolute;
          font-size: 15px;
          height: 0.29in; 
          line-height: 0.29in;
          white-space: nowrap;
          overflow: hidden;
        }
        
        .col-desc  { width: 3.2in; text-align: left; }
        .col-qty   { width: 0.5in; text-align: center; }
        .col-price { width: 1.0in; text-align: right; }
        .col-amt   { width: 1.0in; text-align: right; }

        
        .vatable-sales   { position: absolute; top: calc(7.10in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .vat-amount-left { position: absolute; top: calc(7.35in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .zero-rated      { position: absolute; top: calc(7.65in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .vat-exempt      { position: absolute; top: calc(7.90in + var(--printer-offset)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }

        
        .total-vat-incl  { position: absolute; top: calc(7.10in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .less-vat        { position: absolute; top: calc(7.35in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .net-of-vat      { position: absolute; top: calc(7.65in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .less-discount   { position: absolute; top: calc(7.95in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .add-vat         { position: absolute; top: calc(8.20in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .less-withholding { position: absolute; top: calc(8.45in + var(--printer-offset)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .total-due       { position: absolute; top: calc(8.75in + var(--printer-offset)); left: 6.20in; font-size: 15px; font-weight: bold; text-align: right; width: 1.5in; }

        
      </style>
    </head>
    <body onload="window.print()">

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

    </body>
    </html>
  `;

  return html;
}

export function printReceipt(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number) {
  const html = generateReceiptHTML(order, tin, businessAddress, withholdingTaxRate);

  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
