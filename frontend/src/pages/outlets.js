import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { openModal, confirmModal } from '../components/modal.js';
import { statusBadge, escapeHtml } from '../utils/helpers.js';

let outlets = [];

export function renderOutlets() {
  return `
    <div class="page-header">
      <div>
        <h2>Manajemen Outlet</h2>
        <p>Kelola data outlet yang terdaftar</p>
      </div>
      <button class="btn btn-primary" id="btn-add-outlet">
        <span class="material-icons-round">add</span> Tambah Outlet
      </button>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-search">
          <span class="material-icons-round">search</span>
          <input type="text" class="form-input" id="outlet-search" placeholder="Cari outlet...">
        </div>
        <span style="color: var(--text-muted); font-size: var(--font-xs);" id="outlet-count">0 outlet</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Nama Outlet</th>
            <th>Alamat</th>
            <th>Telepon</th>
            <th>Status</th>
            <th style="width:120px;">Aksi</th>
          </tr>
        </thead>
        <tbody id="outlet-tbody">
          <tr><td colspan="5"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderOutletRows(data) {
  const tbody = document.getElementById('outlet-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><span class="material-icons-round">store</span><p>Belum ada outlet</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(o => `
    <tr>
      <td><strong>${escapeHtml(o.nama)}</strong></td>
      <td style="color: var(--text-secondary);">${escapeHtml(o.alamat || '-')}</td>
      <td>${escapeHtml(o.telepon || '-')}</td>
      <td>${statusBadge(o.status)}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-ghost btn-sm" data-edit="${o.id}" title="Edit">
            <span class="material-icons-round">edit</span>
          </button>
          <button class="btn btn-ghost btn-sm text-danger" data-delete="${o.id}" title="Hapus">
            <span class="material-icons-round">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadOutlets() {
  try {
    outlets = await api.getOutlets();
    renderOutletRows(outlets);
    document.getElementById('outlet-count').textContent = `${outlets.length} outlet`;
  } catch (err) {
    notify.error('Gagal memuat outlet: ' + err.message);
  }
}

function outletFormHtml(data = {}) {
  return `
    <div class="form-group">
      <label class="form-label">Nama Outlet *</label>
      <input type="text" class="form-input" id="f-outlet-nama" value="${escapeHtml(data.nama || '')}" placeholder="Contoh: Outlet Bandung 1" required>
    </div>
    <div class="form-group">
      <label class="form-label">Alamat</label>
      <textarea class="form-textarea" id="f-outlet-alamat" placeholder="Alamat lengkap outlet">${escapeHtml(data.alamat || '')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Telepon</label>
        <input type="text" class="form-input" id="f-outlet-telepon" value="${escapeHtml(data.telepon || '')}" placeholder="081xxxxxxxxx">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-select" id="f-outlet-status">
          <option value="active" ${data.status === 'active' ? 'selected' : ''}>Aktif</option>
          <option value="inactive" ${data.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
        </select>
      </div>
    </div>
  `;
}

export async function initOutlets() {
  await loadOutlets();

  // Add outlet
  document.getElementById('btn-add-outlet')?.addEventListener('click', async () => {
    const result = await openModal('Tambah Outlet Baru', outletFormHtml(), {
      confirmText: 'Simpan',
      onConfirm: () => ({
        nama: document.getElementById('f-outlet-nama').value,
        alamat: document.getElementById('f-outlet-alamat').value,
        telepon: document.getElementById('f-outlet-telepon').value,
        status: document.getElementById('f-outlet-status').value,
      })
    });
    if (result && result.nama) {
      try {
        await api.createOutlet(result);
        notify.success('Outlet berhasil ditambahkan');
        await loadOutlets();
      } catch (err) {
        notify.error('Gagal menambah outlet: ' + err.message);
      }
    }
  });

  // Edit / Delete click delegation
  document.getElementById('outlet-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');

    if (editBtn) {
      const id = editBtn.dataset.edit;
      const outlet = outlets.find(o => o.id === id);
      if (!outlet) return;

      const result = await openModal('Edit Outlet', outletFormHtml(outlet), {
        confirmText: 'Perbarui',
        onConfirm: () => ({
          nama: document.getElementById('f-outlet-nama').value,
          alamat: document.getElementById('f-outlet-alamat').value,
          telepon: document.getElementById('f-outlet-telepon').value,
          status: document.getElementById('f-outlet-status').value,
        })
      });
      if (result && result.nama) {
        try {
          await api.updateOutlet(id, result);
          notify.success('Outlet berhasil diperbarui');
          await loadOutlets();
        } catch (err) {
          notify.error('Gagal update outlet: ' + err.message);
        }
      }
    }

    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      const outlet = outlets.find(o => o.id === id);
      const confirmed = await confirmModal('Hapus Outlet', `Yakin ingin menghapus outlet <strong>${outlet?.nama}</strong>?`);
      if (confirmed) {
        try {
          await api.deleteOutlet(id);
          notify.success('Outlet berhasil dihapus');
          await loadOutlets();
        } catch (err) {
          notify.error('Gagal hapus outlet: ' + err.message);
        }
      }
    }
  });

  // Search
  document.getElementById('outlet-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = outlets.filter(o =>
      o.nama.toLowerCase().includes(q) || (o.alamat || '').toLowerCase().includes(q)
    );
    renderOutletRows(filtered);
  });
}
