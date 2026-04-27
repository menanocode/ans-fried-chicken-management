import { openModal, closeModal } from '../components/modal.js';
import { escapeHtml, formatDate, formatDateTime, formatRupiah } from './helpers.js';

const RECEIPT_LINE_WIDTH = 32;

function parseNotes(notes) {
  const source = String(notes || '').trim();
  if (!source) return { paymentMethod: '-', customerNotes: '' };

  const pieces = source.split('|').map(piece => piece.trim()).filter(Boolean);
  let paymentMethod = '-';
  const customerNotes = [];

  pieces.forEach(piece => {
    if (/^metode\s*:/i.test(piece)) {
      paymentMethod = piece.split(':').slice(1).join(':').trim().toUpperCase() || '-';
      return;
    }
    customerNotes.push(piece);
  });

  return {
    paymentMethod,
    customerNotes: customerNotes.join(' | '),
  };
}

function wrapLine(text, width = RECEIPT_LINE_WIDTH) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return [];

  const words = raw.split(' ');
  const lines = [];
  let current = '';

  words.forEach(word => {
    if (word.length > width) {
      if (current) {
        lines.push(current);
        current = '';
      }
      for (let index = 0; index < word.length; index += width) {
        lines.push(word.slice(index, index + width));
      }
      return;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= width) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  });

  if (current) lines.push(current);
  return lines;
}

function alignCenter(text, width = RECEIPT_LINE_WIDTH) {
  const value = String(text || '').trim();
  if (!value) return '';
  if (value.length >= width) return value;
  const leftPadding = Math.floor((width - value.length) / 2);
  return `${' '.repeat(leftPadding)}${value}`;
}

function padLeft(text, width) {
  const value = String(text || '');
  if (value.length >= width) return value;
  return `${' '.repeat(width - value.length)}${value}`;
}

function alignLeftRight(left, right, width = RECEIPT_LINE_WIDTH) {
  const leftText = String(left || '');
  const rightText = String(right || '');
  const gap = width - leftText.length - rightText.length;
  if (gap >= 1) return `${leftText}${' '.repeat(gap)}${rightText}`;
  return `${leftText}\n${padLeft(rightText, width)}`;
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function getReceiptItems(sale) {
  return safeArray(sale?.sale_items).map((item) => ({
    name: item?.products?.nama || 'Produk',
    qty: Number(item?.jumlah || 0),
    unitPrice: Number(item?.harga_jual || 0),
    subtotal: Number(item?.subtotal || (Number(item?.jumlah || 0) * Number(item?.harga_jual || 0))),
    unit: item?.products?.satuan || '',
  }));
}

export function buildReceiptData(sale, context = {}) {
  const receiptSale = sale || {};
  const { paymentMethod, customerNotes } = parseNotes(receiptSale.notes);
  const items = getReceiptItems(receiptSale);
  const itemCount = items.reduce((sum, item) => sum + item.qty, 0);
  const totalAmount = Number(receiptSale.total_amount || items.reduce((sum, item) => sum + item.subtotal, 0));

  return {
    saleId: receiptSale.id || '',
    saleCode: receiptSale.sale_code || '-',
    transactionDate: receiptSale.tanggal || '',
    createdAt: receiptSale.created_at || '',
    outletName: context.outletName || receiptSale.outlets?.nama || 'Outlet ANS',
    outletAddress: context.outletAddress || receiptSale.outlets?.alamat || '',
    outletPhone: context.outletPhone || receiptSale.outlets?.telepon || '',
    cashierName: context.cashierName || receiptSale.profiles?.nama || '-',
    paymentMethod,
    notes: customerNotes,
    itemCount,
    totalAmount,
    items,
  };
}

function buildReceiptRows(receiptData) {
  const rows = [];

  rows.push(alignCenter(receiptData.outletName));
  wrapLine(receiptData.outletAddress).forEach(line => rows.push(alignCenter(line)));
  if (receiptData.outletPhone) rows.push(alignCenter(`Telp ${receiptData.outletPhone}`));
  rows.push('-'.repeat(RECEIPT_LINE_WIDTH));
  rows.push(alignLeftRight('Kode', receiptData.saleCode));
  rows.push(alignLeftRight('Tanggal', formatDate(receiptData.transactionDate)));
  rows.push(alignLeftRight('Waktu', formatDateTime(receiptData.createdAt || receiptData.transactionDate)));
  rows.push(alignLeftRight('Kasir', receiptData.cashierName));
  rows.push(alignLeftRight('Bayar', receiptData.paymentMethod));
  rows.push('-'.repeat(RECEIPT_LINE_WIDTH));

  receiptData.items.forEach(item => {
    wrapLine(item.name).forEach(line => rows.push(line));
    const qtyText = `${item.qty} x ${formatRupiah(item.unitPrice).replace('Rp ', 'Rp')}`;
    const subtotalText = formatRupiah(item.subtotal).replace('Rp ', 'Rp');
    rows.push(alignLeftRight(qtyText, subtotalText));
  });

  rows.push('-'.repeat(RECEIPT_LINE_WIDTH));
  rows.push(alignLeftRight('Total Item', `${receiptData.itemCount}`));
  rows.push(alignLeftRight('Total', formatRupiah(receiptData.totalAmount).replace('Rp ', 'Rp')));
  if (receiptData.notes) {
    rows.push('-'.repeat(RECEIPT_LINE_WIDTH));
    rows.push('Catatan');
    wrapLine(receiptData.notes).forEach(line => rows.push(line));
  }
  rows.push('-'.repeat(RECEIPT_LINE_WIDTH));
  rows.push(alignCenter('Terima kasih'));
  rows.push(alignCenter('ANS Fried Chicken'));

  return rows;
}

export function buildEscPosBytes(receiptData) {
  const encoder = new TextEncoder();
  const text = `${buildReceiptRows(receiptData).join('\n')}\n\n\n`;
  const init = Uint8Array.from([0x1b, 0x40]);
  const content = encoder.encode(text);
  const cut = Uint8Array.from([0x1d, 0x56, 0x41, 0x10]);
  const output = new Uint8Array(init.length + content.length + cut.length);
  output.set(init, 0);
  output.set(content, init.length);
  output.set(cut, init.length + content.length);
  return output;
}

function buildReceiptPreviewCard(receiptData) {
  const notesHtml = receiptData.notes
    ? `
      <div class="receipt-preview-section">
        <span>Catatan</span>
        <strong>${escapeHtml(receiptData.notes)}</strong>
      </div>
    `
    : '';

  const itemsHtml = receiptData.items.map(item => `
    <div class="receipt-preview-item">
      <div class="receipt-preview-item-name">${escapeHtml(item.name)}</div>
      <div class="receipt-preview-item-meta">
        <span>${item.qty} x ${formatRupiah(item.unitPrice)}</span>
        <strong>${formatRupiah(item.subtotal)}</strong>
      </div>
    </div>
  `).join('');

  return `
    <div class="receipt-preview-shell">
      <div class="receipt-preview-paper" id="receipt-preview-paper">
        <div class="receipt-preview-brand">
          <h4>${escapeHtml(receiptData.outletName)}</h4>
          ${receiptData.outletAddress ? `<p>${escapeHtml(receiptData.outletAddress)}</p>` : ''}
          ${receiptData.outletPhone ? `<p>Telp ${escapeHtml(receiptData.outletPhone)}</p>` : ''}
        </div>
        <div class="receipt-preview-meta">
          <div><span>Kode</span><strong>${escapeHtml(receiptData.saleCode)}</strong></div>
          <div><span>Tanggal</span><strong>${escapeHtml(formatDate(receiptData.transactionDate))}</strong></div>
          <div><span>Waktu</span><strong>${escapeHtml(formatDateTime(receiptData.createdAt || receiptData.transactionDate))}</strong></div>
          <div><span>Kasir</span><strong>${escapeHtml(receiptData.cashierName)}</strong></div>
          <div><span>Bayar</span><strong>${escapeHtml(receiptData.paymentMethod)}</strong></div>
        </div>
        <div class="receipt-preview-items">
          ${itemsHtml}
        </div>
        <div class="receipt-preview-summary">
          <div><span>Total Item</span><strong>${receiptData.itemCount}</strong></div>
          <div class="grand-total"><span>Total</span><strong>${formatRupiah(receiptData.totalAmount)}</strong></div>
        </div>
        ${notesHtml}
        <div class="receipt-preview-footer">
          <p>Terima kasih</p>
          <p>ANS Fried Chicken</p>
        </div>
      </div>
    </div>
  `;
}

function buildPrintDocument(receiptData) {
  return `
    <!doctype html>
    <html lang="id">
      <head>
        <meta charset="utf-8">
        <title>Struk ${escapeHtml(receiptData.saleCode)}</title>
        <style>
          body {
            margin: 0;
            padding: 20px;
            font-family: Arial, sans-serif;
            background: #f3f4f6;
            color: #111827;
          }
          .sheet {
            width: 320px;
            margin: 0 auto;
            background: #fff;
            padding: 18px 16px 22px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.08);
          }
          .brand, .footer {
            text-align: center;
          }
          .brand h1 {
            font-size: 18px;
            margin: 0 0 6px;
          }
          .brand p, .footer p {
            margin: 2px 0;
            font-size: 12px;
          }
          .meta, .summary, .notes {
            border-top: 1px dashed #9ca3af;
            padding-top: 10px;
            margin-top: 10px;
          }
          .meta-row, .summary-row, .item-row {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            font-size: 12px;
            margin-bottom: 6px;
          }
          .item-name {
            font-size: 13px;
            font-weight: 700;
            margin-bottom: 4px;
          }
          .grand-total {
            font-size: 14px;
            font-weight: 700;
          }
          @media print {
            body {
              background: #fff;
              padding: 0;
            }
            .sheet {
              box-shadow: none;
              width: auto;
              margin: 0;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        <div class="sheet">
          <div class="brand">
            <h1>${escapeHtml(receiptData.outletName)}</h1>
            ${receiptData.outletAddress ? `<p>${escapeHtml(receiptData.outletAddress)}</p>` : ''}
            ${receiptData.outletPhone ? `<p>Telp ${escapeHtml(receiptData.outletPhone)}</p>` : ''}
          </div>
          <div class="meta">
            <div class="meta-row"><span>Kode</span><strong>${escapeHtml(receiptData.saleCode)}</strong></div>
            <div class="meta-row"><span>Tanggal</span><strong>${escapeHtml(formatDate(receiptData.transactionDate))}</strong></div>
            <div class="meta-row"><span>Waktu</span><strong>${escapeHtml(formatDateTime(receiptData.createdAt || receiptData.transactionDate))}</strong></div>
            <div class="meta-row"><span>Kasir</span><strong>${escapeHtml(receiptData.cashierName)}</strong></div>
            <div class="meta-row"><span>Bayar</span><strong>${escapeHtml(receiptData.paymentMethod)}</strong></div>
          </div>
          <div class="meta">
            ${receiptData.items.map(item => `
              <div class="item-name">${escapeHtml(item.name)}</div>
              <div class="item-row">
                <span>${item.qty} x ${formatRupiah(item.unitPrice)}</span>
                <strong>${formatRupiah(item.subtotal)}</strong>
              </div>
            `).join('')}
          </div>
          <div class="summary">
            <div class="summary-row"><span>Total Item</span><strong>${receiptData.itemCount}</strong></div>
            <div class="summary-row grand-total"><span>Total</span><strong>${formatRupiah(receiptData.totalAmount)}</strong></div>
          </div>
          ${receiptData.notes ? `<div class="notes"><div class="item-name">Catatan</div><p>${escapeHtml(receiptData.notes)}</p></div>` : ''}
          <div class="footer">
            <p>Terima kasih</p>
            <p>ANS Fried Chicken</p>
          </div>
        </div>
        <script>
          window.addEventListener('load', () => {
            window.print();
          });
        </script>
      </body>
    </html>
  `;
}

function printReceiptDocument(receiptData) {
  const printWindow = window.open('', '_blank', 'width=420,height=720');
  if (!printWindow) throw new Error('Popup browser diblokir. Izinkan pop-up untuk mencetak struk.');
  printWindow.document.open();
  printWindow.document.write(buildPrintDocument(receiptData));
  printWindow.document.close();
}

export function openReceiptPreview(receiptData) {
  return openModal(`Preview Struk ${receiptData.saleCode}`, buildReceiptPreviewModal(receiptData), {
    size: 'lg',
    footer: false,
    onOpen: (modal) => {
      modal.querySelector('#receipt-print-browser-btn')?.addEventListener('click', () => {
        try {
          printReceiptDocument(receiptData);
        } catch (err) {
          window.alert(err.message);
        }
      });

      modal.querySelector('#receipt-close-preview-btn')?.addEventListener('click', () => {
        closeModal();
      });
    },
  });
}

function buildReceiptPreviewModal(receiptData) {
  return `
    <div class="receipt-preview-actions">
      <button type="button" class="btn btn-primary" id="receipt-print-browser-btn">
        <span class="material-icons-round">print</span> Cetak via Browser
      </button>
      <button type="button" class="btn btn-secondary" id="receipt-close-preview-btn">
        <span class="material-icons-round">close</span> Tutup
      </button>
    </div>
    ${buildReceiptPreviewCard(receiptData)}
  `;
}
