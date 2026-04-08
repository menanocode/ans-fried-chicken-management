import { auth } from '../services/auth.js';
import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { confirmModal } from '../components/modal.js';
import { formatDate, formatRupiah, getAppOpenISODate, escapeHtml } from '../utils/helpers.js';

let historyRows = [];

export function renderHistory() {
  if (!auth.isOutlet()) {
    return `
      <div class="card">
        <div class="empty-state" style="padding: var(--sp-8);">
          <span class="material-icons-round">lock</span>
          <h3>Akses dibatasi</h3>
          <p>Menu ini khusus untuk user outlet.</p>
        </div>
      </div>
    `;
  }

  return `
    <div class="page-header">
      <div>
        <h2>History Transaksi</h2>
        <p>Riwayat penjualan outlet Anda berdasarkan rentang tanggal.</p>
      </div>
    </div>

    <div class="filter-bar">
      <input type="date" class="form-input" id="history-date-from" value="${getAppOpenISODate()}">
      <input type="date" class="form-input" id="history-date-to" value="${getAppOpenISODate()}">
      <button class="btn btn-secondary" id="btn-filter-history">
        <span class="material-icons-round">filter_list</span> Filter
      </button>
    </div>

    <div class="stats-grid stagger" id="history-summary"></div>

    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Tanggal</th>
            <th>Jumlah Item</th>
            <th>Total</th>
            <th>Catatan</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody id="history-tbody">
          <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderHistoryRows(rows) {
  const tbody = document.getElementById('history-tbody');
  const summary = document.getElementById('history-summary');
  if (!tbody || !summary) return;

  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="table-empty"><span class="material-icons-round">history</span><p>Belum ada transaksi pada rentang tanggal ini</p></div></td></tr>';
    summary.innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue"><span class="material-icons-round">receipt_long</span></div>
        <div class="stat-info"><div class="stat-label">Transaksi</div><div class="stat-value">0</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><span class="material-icons-round">fastfood</span></div>
        <div class="stat-info"><div class="stat-label">Item Terjual</div><div class="stat-value">0</div></div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><span class="material-icons-round">payments</span></div>
        <div class="stat-info"><div class="stat-label">Total Omset</div><div class="stat-value">${formatRupiah(0)}</div></div>
      </div>
    `;
    return;
  }

  tbody.innerHTML = rows.map(row => {
    const itemCount = (row.sale_items || []).reduce((sum, item) => sum + Number(item.jumlah || 0), 0);
    return `
      <tr>
        <td><strong style="color: var(--orange-400);">${row.sale_code || '-'}</strong></td>
        <td>${formatDate(row.tanggal)}</td>
        <td>${itemCount} item</td>
        <td><strong style="color: var(--success);">${formatRupiah(row.total_amount)}</strong></td>
        <td style="max-width: 300px; white-space: normal;">${row.notes ? escapeHtml(row.notes) : '-'}</td>
        <td class="table-action-cell">
          <button type="button" class="btn btn-ghost btn-sm icon-btn-danger" data-delete-history-sale="${row.id}" title="Hapus transaksi">
            <span class="material-icons-round">delete</span>
            Hapus
          </button>
        </td>
      </tr>
    `;
  }).join('');

  const totalAmount = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);
  const totalItems = rows.reduce((sum, row) => sum + (row.sale_items || []).reduce((itemSum, item) => itemSum + Number(item.jumlah || 0), 0), 0);

  summary.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon blue"><span class="material-icons-round">receipt_long</span></div>
      <div class="stat-info"><div class="stat-label">Transaksi</div><div class="stat-value">${rows.length}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><span class="material-icons-round">fastfood</span></div>
      <div class="stat-info"><div class="stat-label">Item Terjual</div><div class="stat-value">${totalItems}</div></div>
    </div>
    <div class="stat-card">
      <div class="stat-icon green"><span class="material-icons-round">payments</span></div>
      <div class="stat-info"><div class="stat-label">Total Omset</div><div class="stat-value">${formatRupiah(totalAmount)}</div></div>
    </div>
  `;
}

async function loadHistory() {
  try {
    const outletId = auth.getOutletId();
    if (!outletId) {
      notify.error('Outlet user tidak ditemukan.');
      return;
    }

    const dateFrom = document.getElementById('history-date-from')?.value;
    const dateTo = document.getElementById('history-date-to')?.value;

    historyRows = await api.getSales({
      outlet_id: outletId,
      date_from: dateFrom,
      date_to: dateTo,
    });

    renderHistoryRows(historyRows);
  } catch (err) {
    notify.error('Gagal memuat history transaksi: ' + err.message);
  }
}

async function deleteSaleFromHistory(saleId) {
  const sale = historyRows.find(row => row.id === saleId);
  const saleCode = sale?.sale_code || saleId;
  const confirmed = await confirmModal(
    'Hapus transaksi',
    `Transaksi ${saleCode} akan dihapus dan stok akan dikembalikan. Lanjutkan?`
  );
  if (!confirmed) return;

  try {
    await api.deleteSale(saleId);
    notify.success(`Transaksi ${saleCode} berhasil dihapus.`);
    await loadHistory();
  } catch (err) {
    notify.error('Gagal menghapus transaksi: ' + err.message);
  }
}

export async function initHistory() {
  if (!auth.isOutlet()) return;
  await loadHistory();
  document.getElementById('btn-filter-history')?.addEventListener('click', loadHistory);
  document.getElementById('history-tbody')?.addEventListener('click', async (event) => {
    const deleteBtn = event.target.closest('[data-delete-history-sale]');
    if (!deleteBtn) return;
    const saleId = deleteBtn.dataset.deleteHistorySale;
    if (!saleId) return;
    await deleteSaleFromHistory(saleId);
  });
}
