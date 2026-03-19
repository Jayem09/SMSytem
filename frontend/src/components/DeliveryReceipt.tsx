/**
 * Sales Invoice Receipt — prints TEXT ONLY onto pre-printed LETTER (19.5" x 13.5") invoice paper.
 * All positions use absolute positioning (in inches) to align with form fields.
 * No borders or boxes are printed — those are already on the paper.
 *
 * PREVIEW MODE: Shows scanned form as background so you can visually align text.
 * The background is hidden when printing (@media print).
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
  const date = new Date(order.created_at);
  const dateStr = date.toLocaleDateString('en-PH', { year: 'numeric', month: '2-digit', day: '2-digit' });

  
  const customerName = order.customer?.name || order.guest_name || 'WALK-IN';
  const custAddress = (order.customer?.address || businessAddress || '').toUpperCase();

  
  const totalAmount = order.total_amount || 0;
  const fmt = (n: number | undefined | null) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // Build item rows using absolute positioning for columns
  const MAX_ROWS = 10;
  const items = (order.items || []).slice(0, MAX_ROWS);
  const itemRows = items.map((item, index) => {
  const unitPrice = item.unit_price ?? item.price ?? (item.subtotal / item.quantity);
  const subtotal = item.subtotal ?? 0;
  const unit = "PCS";
    
    // Calculate the Y position for this row.
    const baseTop = 2.70;
    const rowHeight = 0.30;
    const topPos = baseTop + (index * rowHeight);

    return `
      <!-- Row ${index + 1} -->
    <div class="col-qty"   style="top:calc(${topPos}in + var(--offset-y)); left:0.80in;">${item.quantity}</div>
    <div class="col-unit"  style="top:calc(${topPos}in + var(--offset-y)); left:1.50in;">${unit}</div>
    <div class="col-desc"  style="top:calc(${topPos}in + var(--offset-y)); left:2.20in;">${item.product?.name || ''}</div>
    <div class="col-price" style="top:calc(${topPos}in + var(--offset-y)); left:5.60in;">${fmt(unitPrice)}</div>
    <div class="col-amt"   style="top:calc(${topPos}in + var(--offset-y)); left:6.70in;">${fmt(subtotal)}</div>
    `;
  }).join('');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice Preview — Align &amp; Print</title>
      <style>
        .bir-delivery-app {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
          width: 7.6in;
          height: 11.6in;
          position: relative;
          font-family: "Courier New", monospace;
          background: white;
          --offset-x: 0in;
          --offset-y: 0in;
        }
        .bir-delivery-app * { margin: 0; padding: 0; box-sizing: border-box; }
        
        @page {
          size: 7.68in 5.31in;
          margin: 0;
        }

        /* ═══════════════════════════════════════════════
           BACKGROUND TEMPLATE — visible on screen only
           Hidden when printing on actual pre-printed paper
           ═══════════════════════════════════════════════ */
        .bg-template {
          position: absolute;
          top: 0;
          left: 0;
          width: 7.68in;
          height: 5.31in;
          opacity: 0.25;
          z-index: 0;
        }
        .bg-template img {
          width: 100%;
          height: 100%;
          object-fit: fill;
        }

        /* Hide background + toolbar when actually printing */
        @media print {
          .toolbar { display: none !important; }
        }

        
        .bir-delivery-app .date-field, .bir-delivery-app .reg-name, .bir-delivery-app .tin-field, .bir-delivery-app .address,
        .bir-delivery-app .items-table, .bir-delivery-app .vatable-sales, .bir-delivery-app .vat-amount-left,
        .bir-delivery-app .zero-rated, .bir-delivery-app .vat-exempt, .bir-delivery-app .total-vat-incl,
        .bir-delivery-app .less-vat, .bir-delivery-app .net-of-vat, .bir-delivery-app .less-discount,
        .bir-delivery-app .add-vat, .bir-delivery-app .less-withholding, .bir-delivery-app .total-due {
          z-index: 1;
        }

        

        /* ---------- Customer Info Section ---------- */
        .bir-delivery-app .reg-name {
          position:absolute;
          top:calc(1.70in + var(--offset-y));
          left:1.30in;
          font-size:15px;
        }

        .bir-delivery-app .address{
          position:absolute;
          top:calc(2.00in + var(--offset-y));
          left:1.30in;
          font-size:15px;
          width:4.5in;
        }

        .bir-delivery-app .date-field{
          position:absolute;
          top:calc(2.00in + var(--offset-y));
          left:6.10in;
          font-size:15px;
        }
        .bir-delivery-app .tin-field   { position: absolute; top: calc(2.50in + var(--offset-y));  left: 1.05in;  font-size: 15px; }

        .bir-delivery-app .col-qty, .bir-delivery-app .col-unit, .bir-delivery-app .col-desc, .bir-delivery-app .col-price, .bir-delivery-app .col-amt {
          position: absolute;
          font-size: 15px;
          height: 0.29in;
          line-height: 0.29in;
          white-space: nowrap;
          overflow: hidden;
        }
        
        .bir-delivery-app .col-qty   { width: 0.4in; text-align: center; }
        .bir-delivery-app .col-unit  { width: 0.5in; text-align: center; }
        .bir-delivery-app .col-desc  { width: 3.5in; text-align: left; }
        .bir-delivery-app .col-price { width: 1.0in; text-align: right; }
        .bir-delivery-app .col-amt   { width: 1.0in; text-align: right; }

        .bir-delivery-app .total-due       { position: absolute; top: calc(8.80in + var(--offset-y)); left: 6.70in; font-size: 15px; text-align: right; width: 1.5in; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="bir-delivery-app">

      <!-- Customer Info -->
      <div class="date-field">${dateStr}</div>
      <div class="reg-name">${customerName}</div>
      <div class="address">${custAddress}</div>

      <!-- Items -->
      ${itemRows}

      <!-- Total Amount Only -->
      <div class="total-due">${fmt(totalAmount)}</div>
      </div>
    </body>
    </html>
  `;

  return html;
}

export function printDeliveryReceipt(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number) {
  const htmlContent = generateDeliveryReceiptHTML(order, tin, businessAddress, withholdingTaxRate);

  // Use the #print-area from index.css for high-reliability, glitch-free printing
  let container = document.getElementById('print-area');
  if (!container) {
    container = document.createElement('div');
    container.id = 'print-area';
    document.body.appendChild(container);
  }

  // Extract content and styles
  const headContent = htmlContent.match(/<head[^>]*>([\s\S]*)<\/head>/)?.[1] || '';
  const bodyInner = htmlContent.match(/<body[^>]*>([\s\S]*)<\/body>/)?.[1] || htmlContent;

  container.innerHTML = `
    ${headContent}
    ${bodyInner}
  `;

  // Standard main-window print call
  setTimeout(() => {
    window.print();
    
    // Delayed cleanup to prevent blank PDF in Tauri
    setTimeout(() => {
      if (container) container.innerHTML = '';
    }, 2000);
  }, 500);
}
