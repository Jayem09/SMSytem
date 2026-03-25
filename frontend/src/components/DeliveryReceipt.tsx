/**
 * Sales Invoice Receipt — prints TEXT ONLY onto pre-printed LETTER invoice paper.
 * All positions use absolute positioning (in inches) to align with form fields.
 */

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _whTaxRate = _withholdingTaxRate;
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const customerName = order.customer?.name || order.guest_name || 'WALK-IN';
  const custAddress = (order.customer?.address || businessAddress || '').toUpperCase();

  const totalAmount = order.total_amount || 0;
  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Build item rows
  const MAX_ROWS = 10;
  const items = (order.items || []).slice(0, MAX_ROWS);
  const itemRows = items.map((item, index) => {
    const unitPrice = item.unit_price ?? item.price ?? (item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    const unit = "PCS";
    
    const baseTop = 2.35; // slightly upwards
    const rowHeight = 0.30; 
    const topPos = baseTop + (index * rowHeight);

    return `
      <div class="col-qty"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-qty) + var(--offset-x));">${item.quantity}</div>
      <div class="col-unit"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-unit) + var(--offset-x));">${unit}</div>
      <div class="col-desc"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-desc) + var(--offset-x));">${item.product?.name || ''}</div>
      <div class="col-price" style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-price) - 0.13in + var(--offset-x));">${fmt(unitPrice)}</div>
      <div class="col-amt"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-amt) - 0.10in + var(--offset-x));">${fmt(subtotal)}</div>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice Preview</title>
      <style>
        .bir-delivery-app {
          margin: 0;
        }
        
        :root {
          /* Column Horizontal Bases */
          --col-qty: 0.60in;
          --col-unit: 0.95in;
          --col-desc: 1.70in;
          --col-price: 5.50in; /* move unit price slightly left */
          --col-amt: 6.30in;   /* move amount slightly left */

          /* MASTER OFFSETS: Adjust these to shift EVERYTHING vertically */
          --offset-x: -0.30in; 
          --offset-y: -0.55in; /* moves name, address, date, items UP */
        }

        html, body {
          width: 7.68in;
          height: 5.31in;
          font-family: "Courier New", monospace;
          position: relative;
          background: transparent;
        }

        @media print {
          .toolbar { display: none !important; }
        }

        /* Customer Info Section */
        .reg-name {
          position: absolute;
          top: calc(1.75in + var(--offset-y)); /* slightly up */
          left: calc(1.60in + var(--offset-x));
          font-size: 15px;
        }

        .address {
          position: absolute;
          top: calc(1.95in + var(--offset-y)); /* slightly up */
          left: calc(1.30in + var(--offset-x));
          font-size: 15px;
          width: 4.5in;
        }

        .date-field {
          position: absolute;
          top: calc(1.95in + var(--offset-y)); /* slightly up */
          left: calc(6.50in + var(--offset-x));
          font-size: 15px;
        }

        /* Items Section */
        .col-qty, .col-unit, .col-desc, .col-price, .col-amt {
          position: absolute;
          font-size: 13px;
          height: 0.30in;
          line-height: 0.30in;
          white-space: nowrap;
        }
        
        .col-qty   { width: 0.5in; text-align: center; }
        .col-unit  { width: 0.5in; text-align: center; }
        .col-desc  { width: 3.2in; text-align: left; }
        .col-price { width: 1.0in; text-align: right; }
        .col-amt   { width: 1.0in; text-align: right; }

        .total-due {
          position: absolute;
          top: calc(4.90in + var(--offset-y)); /* slightly up, the higher = downwards */
          left: calc(6.90in + var(--offset-x)); /* push backwards slightly - higher the value = move backwards (right)*/
          width: 1in;
          font-size: 16px;
          font-weight: bold;
          text-align: right;
        }
      </style>
    </head>
    <body onload="window.print()">
      <div class="date-field">${dateStr}</div>
      <div class="reg-name">${customerName}</div>
      <div class="address">${custAddress}</div>
      ${itemRows}
      <div class="total-due">${fmt(totalAmount)}</div>
    </body>
    </html>
  `;
}

export async function printDeliveryReceipt(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number) {
  const htmlContent = generateDeliveryReceiptHTML(order, tin, businessAddress, withholdingTaxRate);

  // Use the #print-area for consistent printing
  let container = document.getElementById('print-area');
  if (!container) {
    container = document.createElement('div');
    container.id = 'print-area';
    document.body.appendChild(container);
  }

  const headContent = htmlContent.match(/<head[^>]*>([\s\S]*)<\/head>/)?.[1] || '';
  const bodyInner = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || htmlContent;

  container.innerHTML = `
    ${headContent}
    ${bodyInner}
  `;

  // Use Tauri print API if available, fallback to window.print
  try {
    const { print } = await import('@tauri-apps/api/webview');
    await print();
  } catch {
    window.print();
  }
  
  setTimeout(() => {
    if (container) container.innerHTML = '';
  }, 2000);
}