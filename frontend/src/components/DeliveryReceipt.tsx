

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

export function generateDeliveryReceiptHTML(order: ReceiptOrder, _tin?: string, businessAddress?: string, _withholdingTaxRate?: number): string {
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' });

  
  const customerName = order.customer?.name || order.guest_name || 'WALK-IN';
  const custAddress = (order.customer?.address || businessAddress || '').toUpperCase();

  
  const totalAmount = order.total_amount || 0;
  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  
  
  const items = order.items || [];
  const itemRows = items.map((item, index) => {
    const unitPrice = item.unit_price ?? item.price ?? (item.subtotal && item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    const unit = "PCS"; 
    
    
    const baseTop = 3.47; 
    const rowHeight = 0.29;
    const topPos = baseTop + (index * rowHeight);

    return `
      <!-- Row ${index + 1} -->
      <div class="col-qty"   style="top: calc(${topPos}in + var(--printer-offset)); left: 0.60in;">${item.quantity}</div>
      <div class="col-unit"  style="top: calc(${topPos}in + var(--printer-offset)); left: 1.05in;">${unit}</div>
      <div class="col-desc"  style="top: calc(${topPos}in + var(--printer-offset)); left: 1.65in;">${item.product?.name || ''}</div>
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
          .toolbar { display: none !important; }
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
        .address    { position: absolute; top: calc(2.55in + var(--printer-offset));  left: 1.05in;  font-size: 14px; width: 4.5in; line-height: 1.2; }

        
        .col-qty, .col-unit, .col-desc, .col-price, .col-amt {
          position: absolute;
          font-size: 15px;
          height: 0.29in;
          line-height: 0.29in;
          white-space: nowrap;
          overflow: hidden;
        }
        
        .col-qty   { width: 0.4in; text-align: center; }
        .col-unit  { width: 0.5in; text-align: center; }
        .col-desc  { width: 3.5in; text-align: left; }
        .col-price { width: 1.0in; text-align: right; }
        .col-amt   { width: 1.0in; text-align: right; }

        
        .total-due { position: absolute; top: calc(8.75in + var(--printer-offset)); left: 6.20in; font-size: 18px; font-weight: bold; text-align: right; width: 1.5in; border-top: 1px solid #000; padding-top: 5px; }
      </style>
    </head>
    <body onload="window.print()">

      <!-- Customer Info -->
      <div class="date-field">${dateStr}</div>
      <div class="reg-name">${customerName}</div>
      <div class="address">${custAddress}</div>

      <!-- Items -->
      ${itemRows}

      <!-- Total Amount Only -->
      <div class="total-due">${fmt(totalAmount)}</div>

    </body>
    </html>
  `;

  return html;
}

export function printDeliveryReceipt(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number) {
  const html = generateDeliveryReceiptHTML(order, tin, businessAddress, withholdingTaxRate);

  const printWindow = window.open('', '_blank', 'width=850,height=1100');
  if (printWindow) {
    printWindow.document.write(html);
    printWindow.document.close();
  }
}
