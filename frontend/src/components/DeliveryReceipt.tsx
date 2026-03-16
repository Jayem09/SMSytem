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

  // Customer info
  const customerName = order.customer?.name || order.guest_name || 'WALK-IN';
  const custAddress = (order.customer?.address || businessAddress || '').toUpperCase();

  // Simple total (No Tax)
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
        * { margin: 0; padding: 0; box-sizing: border-box; }
        @page {
          size: 7.68in 5.31in;
          margin: 0;
        }
        body {
          width: 7.68in;
          height: 5.31in;
          transform-origin: top left;
          font-family: "Courier New", monospace;
          position: relative;
          /* ★ PRINTER OFFSET — adjust this single value to shift ALL text up/down ★
             Negative = move UP, Positive = move DOWN
             Change this when switching printers */
          --offset-x: 0in;
          --offset-y: 0in;
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
          /* TEMP: Allow background image on print for alignment verification */
           .bg-template { 
             display: block !important; 
             opacity: 0.25 !important; 
             -webkit-print-color-adjust: exact !important; 
             print-color-adjust: exact !important; 
           }
           .bg-template img { 
             display: block !important; 
             opacity: 0.25 !important; 
           }
          .toolbar { display: none !important; }
        }

        /* All text fields sit above the background */
        .date-field, .reg-name, .tin-field, .address,
        .items-table, .vatable-sales, .vat-amount-left,
        .zero-rated, .vat-exempt, .total-vat-incl,
        .less-vat, .net-of-vat, .less-discount,
        .add-vat, .less-withholding, .total-due {
          z-index: 1;
        }

        /* ══════════════════════════════════════════════
           POSITION GUIDE — calibrated from scanned form
           Paper: Letter 8.5" × 11"
           All values are in inches from top-left corner.
           ══════════════════════════════════════════════ */

        /* ---------- Customer Info Section ---------- */
        .reg-name {
          position:absolute;
          top:calc(1.70in + var(--offset-y));
          left:1.30in;
          font-size:15px;
        }

        .address{
          position:absolute;
          top:calc(2.00in + var(--offset-y));
          left:1.30in;
          font-size:15px;
          width:4.5in;
        }

        .date-field{
          position:absolute;
          top:calc(2.00in + var(--offset-y));
          left:6.10in;
          font-size:15px;
        }
        .tin-field   { position: absolute; top: calc(2.50in + var(--offset-y));  left: 1.05in;  font-size: 15px; }
  
        /* ---------- Items (Absolute Layout) ---------- */
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

        /* ---------- Tax Summary (Bottom Left) ---------- */
        .vatable-sales   { position: absolute; top: calc(7.10in + var(--offset-y)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .vat-amount-left { position: absolute; top: calc(7.35in + var(--offset-y)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .zero-rated      { position: absolute; top: calc(7.65in + var(--offset-y)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }
        .vat-exempt      { position: absolute; top: calc(7.90in + var(--offset-y)); left: 2.40in; font-size: 15px; text-align: right; width: 1.2in; }

        /* ---------- Tax Summary (Bottom Right) ---------- */
        .total-vat-incl  { position: absolute; top: calc(7.10in + var(--offset-y)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .less-vat        { position: absolute; top: calc(7.35in + var(--offset-y)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .net-of-vat      { position: absolute; top: calc(7.65in + var(--offset-y)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .less-discount   { position: absolute; top: calc(7.95in + var(--offset-y)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .add-vat         { position: absolute; top: calc(8.20in + var(--offset-y)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .less-withholding { position: absolute; top: calc(8.45in + var(--offset-y)); left: 6.20in; font-size: 15px; text-align: right; width: 1.5in; }
        .total-due       { position: absolute; top: calc(8.80in + var(--offset-y)); left: 6.70in; font-size: 15px; text-align: right; width: 1.5in; font-weight: bold; }position:absolute; }
        /* ---------- Toolbar ---------- */
        .toolbar {
          position: fixed;
          top: 10px;
          right: 10px;
          z-index: 9999;
          display: flex;
          gap: 8px;
          background: #333;
          padding: 8px 12px;
          border-radius: 8px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        .toolbar button {
          padding: 6px 14px;
          font-size: 13px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        }
        .btn-print {
          background: #4CAF50;
          color: white;
        }
        .btn-toggle {
          background: #2196F3;
          color: white;
        }
        .btn-close {
          background: #f44336;
          color: white;
        }
      </style>
    </head>
    <body>

      <!-- Toolbar for preview controls (hidden when printing) -->
      <div class="toolbar">
        <button class="btn-toggle" onclick="toggleBg()">Toggle Background</button>
        <button class="btn-print" onclick="window.print()">🖨️ Print</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>

      <!-- Scanned form background (visible on screen only) -->
      <div class="bg-template" id="bgTemplate">
        <img src="/PLDT_NEW_SI_FORMAT.png" alt="Invoice template" />
      </div>

      <!-- Customer Info -->
      <div class="date-field">${dateStr}</div>
      <div class="reg-name">${customerName}</div>
      <div class="address">${custAddress}</div>

      <!-- Items -->
      ${itemRows}

      <!-- Total Amount Only -->
      <div class="total-due">${fmt(totalAmount)}</div>

      <script>
        function toggleBg() {
          const bg = document.getElementById('bgTemplate');
          if (bg.style.display === 'none') {
            bg.style.display = 'block';
          } else {
            bg.style.display = 'none';
          }
        }
      </script>
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
