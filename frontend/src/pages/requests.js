import { auth } from '../services/auth.js';
import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { openModal, confirmModal } from '../components/modal.js';
import { statusBadge, formatDateTime, escapeHtml } from '../utils/helpers.js';

let requests = [];
let products = [];

export function renderRequests() {
  const isOutlet = auth.isOutlet();
  return `
    <div class="page-header">
      <div>
        <h2>Permintaan Stok</h2>
        <p>${isOutlet ? 'Ajukan permintaan stok ke pusat' : 'Kelola permintaan stok dari outlet'}</p>
      </div>
      ${isOutlet ? `
        <button class="btn btn-primary" id="btn-new-request">
          <span class="material-icons-round">add</span> Ajukan Permintaan
        </button>
      ` : ''}
    </div>
    <div class="filter-bar">
      <select class="form-select" id="filter-status">
        <option value="">Semua Status</option>
        <option value="pending">Pending</option>
        <option value="approved">Disetujui</option>
        <option value="rejected">Ditolak</option>
      </select>
    </div>
    <div id="requests-list">
      <div class="loading-spinner"><div class="spinner"></div></div>
    </div>
  `;
}

function renderRequestCards(data) {
  const el = document.getElementById('requests-list');
  if (!data.length) {
    el.innerHTML = `<div class="empty-state"><span class="material-icons-round">local_shipping</span><h3>Belum Ada Permintaan</h3><p>Belum ada permintaan stok yang diajukan</p></div>`;
    return;
  }
  el.innerHTML = data.map(r => `
    <div class="card mb-4 slide-up">
      <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom: var(--sp-4); flex-wrap:wrap; gap: var(--sp-2);">
        <div>
          <div style="display:flex; align-items:center; gap: var(--sp-3);">
            <span style="font-weight:700; font-size: var(--font-md);">${r.request_code || 'N/A'}</span>
            ${statusBadge(r.status)}
          </div>
          <div style="font-size: var(--font-xs); color: var(--text-muted); margin-top: var(--sp-1);">
            <span class="material-icons-round" style="font-size:14px; vertical-align: middle;">store</span>
            ${r.outlets?.nama || '-'} · ${formatDateTime(r.created_at)}
          </div>
        </div>
        ${r.status === 'pending' && auth.isAdmin() ? `
          <div class="btn-group">
            <button class="btn btn-success btn-sm" data-approve="${r.id}">
              <span class="material-icons-round">check</span> Setujui
            </button>
            <button class="btn btn-danger btn-sm" data-reject="${r.id}">
              <span class="material-icons-round">close</span> Tolak
            </button>
          </div>
        ` : ''}
      </div>
      ${r.notes ? `<div style="font-size: var(--font-xs); color: var(--text-secondary); margin-bottom: var(--sp-3); padding: var(--sp-2) var(--sp-3); background: var(--bg-input); border-radius: var(--radius-sm);">📝 ${escapeHtml(r.notes)}</div>` : ''}
      <table style="width:100%;">
        <thead><tr><th>Produk</th><th>Jumlah Diminta</th>${r.status === 'approved' ? '<th>Jumlah Disetujui</th>' : ''}</tr></thead>
        <tbody>
          ${(r.stock_request_items || []).map(item => `
            <tr>
              <td>${item.products?.nama || '-'}</td>
              <td>${item.jumlah} ${item.products?.satuan || ''}</td>
              ${r.status === 'approved' ? `<td style="color: var(--success); font-weight:600;">${item.jumlah_approved ?? item.jumlah}</td>` : ''}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('');
}

async function loadRequests(filters = {}) {
  try {
    const f = { ...filters };
    if (auth.isOutlet()) f.outlet_id = auth.getOutletId();
    requests = await api.getStockRequests(f);
    renderRequestCards(requests);
  } catch (err) {
    notify.error('Gagal memuat permintaan: ' + err.message);
  }
}

export async function initRequests() {
  products = await api.getProducts();
  await loadRequests();

  // Filter by status
  document.getElementById('filter-status')?.addEventListener('change', (e) => {
    const status = e.target.value;
    loadRequests(status ? { status } : {});
  });

  // New request (outlet)
  document.getElementById('btn-new-request')?.addEventListener('click', async () => {
    let itemCount = 1;
    const productsOptions = products.filter(p => p.is_active).map(p =>
      `<option value="${p.id}">${p.nama} (${p.satuan})</option>`
    ).join('');

    const formHtml = `
      <div id="request-items">
        <div class="form-row request-item" data-idx="0">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Produk</label>
            <select class="form-select ri-product">${productsOptions}</select>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Jumlah</label>
            <input type="number" class="form-input ri-jumlah" value="10" min="1">
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm mt-4" id="add-request-item">
        <span class="material-icons-round">add</span> Tambah Item
      </button>
      <div class="form-group mt-4">
        <label class="form-label">Catatan</label>
        <textarea class="form-textarea" id="f-req-notes" placeholder="Catatan tambahan (opsional)"></textarea>
      </div>
    `;

    const result = await openModal('Ajukan Permintaan Stok', formHtml, {
      confirmText: 'Kirim Permintaan',
      size: 'lg',
      onOpen: (modal) => {
        modal.querySelector('#add-request-item')?.addEventListener('click', () => {
          const container = modal.querySelector('#request-items');
          const div = document.createElement('div');
          div.className = 'form-row request-item';
          div.innerHTML = `
            <div class="form-group" style="flex:2;">
              <select class="form-select ri-product">${productsOptions}</select>
            </div>
            <div class="form-group" style="flex:1;">
              <input type="number" class="form-input ri-jumlah" value="10" min="1">
            </div>
            <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="this.parentElement.remove()" style="margin-top:4px;">
              <span class="material-icons-round">delete</span>
            </button>
          `;
          container.appendChild(div);
        });
      },
      onConfirm: () => {
        const items = [];
        document.querySelectorAll('.request-item').forEach(row => {
          const product_id = row.querySelector('.ri-product')?.value;
          const jumlah = Number(row.querySelector('.ri-jumlah')?.value || 0);
          if (product_id && jumlah > 0) items.push({ product_id, jumlah });
        });
        const notes = document.getElementById('f-req-notes')?.value;
        return { items, notes };
      }
    });

    if (result && result.items?.length > 0) {
      try {
        await api.createStockRequest(auth.getOutletId(), result.items, result.notes);
        notify.success('Permintaan stok berhasil dikirim');
        await loadRequests();
      } catch (err) {
        notify.error('Gagal mengirim permintaan: ' + err.message);
      }
    }
  });

  // Approve / Reject
  document.getElementById('requests-list')?.addEventListener('click', async (e) => {
    const approveBtn = e.target.closest('[data-approve]');
    const rejectBtn = e.target.closest('[data-reject]');

    if (approveBtn) {
      const id = approveBtn.dataset.approve;
      const req = requests.find(r => r.id === id);
      if (!req) return;

      // Set approved amounts = requested amounts by default
      const items = (req.stock_request_items || []).map(item => ({
        id: item.id,
        jumlah_approved: item.jumlah
      }));

      try {
        await api.approveStockRequest(id, items);
        notify.success('Permintaan disetujui & stok terupdate');
        await loadRequests();
      } catch (err) {
        notify.error('Gagal menyetujui: ' + err.message);
      }
    }

    if (rejectBtn) {
      const id = rejectBtn.dataset.reject;
      const confirmed = await confirmModal('Tolak Permintaan', 'Yakin ingin menolak permintaan ini?');
      if (confirmed) {
        try {
          await api.rejectStockRequest(id);
          notify.success('Permintaan ditolak');
          await loadRequests();
        } catch (err) {
          notify.error('Gagal menolak: ' + err.message);
        }
      }
    }
  });
}
