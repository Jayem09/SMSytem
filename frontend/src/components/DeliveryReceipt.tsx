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
  customer?: { name: string; address?: string };
  guest_name?: string;
  items?: ReceiptOrderItem[];
}

function escapeHtml(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
  const items = order.items || [];

  // Separate regular items and rewards
  const regularItems = items.filter(item => {
    const unitPrice = item.unit_price ?? item.price ?? (item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    return !(unitPrice === 0 && subtotal === 0);
  });

  const rewardItems = items.filter(item => {
    const unitPrice = item.unit_price ?? item.price ?? (item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    return unitPrice === 0 && subtotal === 0;
  });

  const discountAmount = order.discount_amount ?? 0;
  const unit = "PCS";

  // Build rows: regular items first, then rewards, then discount
  let rowIndex = 0;
  let itemRows = '';

  // Regular items
  regularItems.slice(0, MAX_ROWS).forEach((item) => {
    const unitPrice = item.unit_price ?? item.price ?? (item.quantity ? item.subtotal / item.quantity : 0);
    const subtotal = item.subtotal ?? 0;
    const baseTop = 2.35;
    const rowHeight = 0.30;
    const topPos = baseTop + (rowIndex * rowHeight);
    itemRows += `
      <div class="col-qty"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-qty) + var(--offset-x));">${item.quantity}</div>
      <div class="col-unit"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-unit) + var(--offset-x));">${unit}</div>
      <div class="col-desc"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-desc) + var(--offset-x));">${escapeHtml(item.product?.name || '')}</div>
      <div class="col-price" style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-price) - 0.13in + var(--offset-x));">${fmt(unitPrice)}</div>
      <div class="col-amt"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-amt) - 0.10in + var(--offset-x));">${fmt(subtotal)}</div>
    `;
    rowIndex++;
  });

  // Reward items
  rewardItems.slice(0, MAX_ROWS - rowIndex).forEach((item) => {
    const itemName = `${item.product?.name || ''} (REWARD)`;
    const baseTop = 2.35;
    const rowHeight = 0.30;
    const topPos = baseTop + (rowIndex * rowHeight);
    itemRows += `
      <div class="col-qty"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-qty) + var(--offset-x));">${item.quantity}</div>
      <div class="col-unit"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-unit) + var(--offset-x));">${unit}</div>
      <div class="col-desc"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-desc) + var(--offset-x));">${escapeHtml(itemName)}</div>
      <div class="col-price" style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-price) - 0.13in + var(--offset-x));">FREE</div>
      <div class="col-amt"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-amt) - 0.10in + var(--offset-x));">FREE</div>
    `;
    rowIndex++;
  });

  // Discount at the end
  if (discountAmount > 0 && rowIndex < MAX_ROWS) {
    const baseTop = 2.35;
    const rowHeight = 0.30;
    const topPos = baseTop + (rowIndex * rowHeight);
    itemRows += `
      <div class="col-qty"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-qty) + var(--offset-x));">-</div>
      <div class="col-unit"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-unit) + var(--offset-x));">-</div>
      <div class="col-desc"  style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-desc) + var(--offset-x));">DISCOUNT</div>
      <div class="col-price" style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-price) - 0.13in + var(--offset-x));">-${fmt(discountAmount)}</div>
      <div class="col-amt"   style="top:calc(${topPos}in + var(--offset-y)); left:calc(var(--col-amt) - 0.10in + var(--offset-x));">-${fmt(discountAmount)}</div>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice Preview</title>
      <style>
        .bir-delivery-app {
          margin: 0;
          width: 7.68in;
          height: 5.31in;
          position: relative;
          background: white;
          overflow: hidden;
          font-family: "Courier New", monospace;
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

        @page {
          size: 7.68in 5.31in;
          margin: 0;
        }

        @media print {
          html, body {
            margin: 0;
            padding: 0;
            width: 7.68in;
            height: 5.31in;
            background: white;
            overflow: hidden;
          }

          .toolbar { display: none !important; }
        }

        /* Customer Info Section */
        .bir-delivery-app .reg-name {
          position: absolute;
          top: calc(1.75in + var(--offset-y)); /* slightly up */
          left: calc(1.60in + var(--offset-x));
          font-size: 15px;
        }

        .bir-delivery-app .address {
          position: absolute;
          top: calc(1.95in + var(--offset-y)); /* slightly up */
          left: calc(1.30in + var(--offset-x));
          font-size: 15px;
          width: 4.5in;
        }

        .bir-delivery-app .date-field {
          position: absolute;
          top: calc(1.95in + var(--offset-y)); /* slightly up */
          left: calc(6.50in + var(--offset-x));
          font-size: 15px;
        }

        /* Items Section */
        .bir-delivery-app .col-qty, .bir-delivery-app .col-unit, .bir-delivery-app .col-desc, .bir-delivery-app .col-price, .bir-delivery-app .col-amt {
          position: absolute;
          font-size: 13px;
          height: 0.30in;
          line-height: 0.30in;
          white-space: nowrap;
        }
        
        .bir-delivery-app .col-qty   { width: 0.5in; text-align: center; }
        .bir-delivery-app .col-unit  { width: 0.5in; text-align: center; }
        .bir-delivery-app .col-desc  { width: 3.2in; text-align: left; }
        .bir-delivery-app .col-price { width: 1.0in; text-align: right; }
        .bir-delivery-app .col-amt   { width: 1.0in; text-align: right; }

        .bir-delivery-app .total-due {
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
    <body>
      <div class="bir-delivery-app">
        <div class="date-field">${dateStr}</div>
        <div class="reg-name">${customerName}</div>
        <div class="address">${custAddress}</div>
        ${itemRows}
        <div class="total-due">${fmt(totalAmount)}</div>
      </div>
    </body>
    </html>
  `;
}

export async function printDeliveryReceipt(order: ReceiptOrder, tin?: string, businessAddress?: string, withholdingTaxRate?: number) {
  const htmlContent = generateDeliveryReceiptHTML(order, tin, businessAddress, withholdingTaxRate);

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
