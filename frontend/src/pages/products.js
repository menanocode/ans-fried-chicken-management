import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { openModal } from '../components/modal.js';
import { formatRupiah, escapeHtml } from '../utils/helpers.js';

let products = [];
let categories = [];

export function renderProducts() {
  return `
    <div class="page-header">
      <div>
        <h2>Manajemen Produk</h2>
        <p>Kelola produk ayam goreng dan minuman</p>
      </div>
      <button class="btn btn-primary" id="btn-add-product">
        <span class="material-icons-round">add</span> Tambah Produk
      </button>
    </div>
    <div class="tabs" id="product-tabs">
      <button class="tab active" data-cat="all">Semua</button>
    </div>
    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-search">
          <span class="material-icons-round">search</span>
          <input type="text" class="form-input" id="product-search" placeholder="Cari produk...">
        </div>
        <span style="color: var(--text-muted); font-size: var(--font-xs);" id="product-count">0 produk</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Produk</th>
            <th>Kategori</th>
            <th>Satuan</th>
            <th>HPP</th>
            <th>Margin</th>
            <th>Harga Jual</th>
            <th>Status</th>
            <th style="width:80px;">Aksi</th>
          </tr>
        </thead>
        <tbody id="product-tbody">
          <tr><td colspan="8"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderProductRows(data) {
  const tbody = document.getElementById('product-tbody');
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><span class="material-icons-round">fastfood</span><p>Belum ada produk</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(p => `
    <tr>
      <td><strong>${escapeHtml(p.nama)}</strong></td>
      <td><span class="badge badge-orange">${p.categories?.icon || '📦'} ${p.categories?.nama || '-'}</span></td>
      <td>${p.satuan}</td>
      <td>${formatRupiah(p.hpp)}</td>
      <td>${p.margin_persen}%</td>
      <td><strong style="color: var(--success);">${formatRupiah(p.harga_jual)}</strong></td>
      <td>${p.is_active ? '<span class="badge badge-success">Aktif</span>' : '<span class="badge badge-secondary">Nonaktif</span>'}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-ghost btn-sm" data-edit="${p.id}" title="Edit">
            <span class="material-icons-round">edit</span>
          </button>
          <button class="btn btn-ghost btn-sm text-danger" data-delete="${p.id}" title="Hapus">
            <span class="material-icons-round">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

async function loadData() {
  try {
    [products, categories] = await Promise.all([api.getProducts(), api.getCategories()]);
    renderProductRows(products);
    document.getElementById('product-count').textContent = `${products.length} produk`;
    
    // Render category tabs
    const tabsEl = document.getElementById('product-tabs');
    tabsEl.innerHTML = `
      <button class="tab active" data-cat="all">Semua</button>
      ${categories.map(c => `<button class="tab" data-cat="${c.id}">${c.icon} ${c.nama}</button>`).join('')}
    `;
    initTabEvents();
  } catch (err) {
    notify.error('Gagal memuat produk: ' + err.message);
  }
}

function initTabEvents() {
  document.querySelectorAll('#product-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#product-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const cat = tab.dataset.cat;
      const filtered = cat === 'all' ? products : products.filter(p => p.category_id === cat);
      renderProductRows(filtered);
    });
  });
}

function productFormHtml(data = {}) {
  return `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Nama Produk *</label>
        <input type="text" class="form-input" id="f-prod-nama" value="${escapeHtml(data.nama || '')}" placeholder="Contoh: Ayam Goreng Original">
      </div>
      <div class="form-group">
        <label class="form-label">Kategori *</label>
        <select class="form-select" id="f-prod-category">
          ${categories.map(c => `<option value="${c.id}" ${data.category_id === c.id ? 'selected' : ''}>${c.icon} ${c.nama}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">Satuan</label>
        <select class="form-select" id="f-prod-satuan">
          <option value="pcs" ${data.satuan === 'pcs' ? 'selected' : ''}>pcs</option>
          <option value="cup" ${data.satuan === 'cup' ? 'selected' : ''}>cup</option>
          <option value="botol" ${data.satuan === 'botol' ? 'selected' : ''}>botol</option>
          <option value="porsi" ${data.satuan === 'porsi' ? 'selected' : ''}>porsi</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Margin (%)</label>
        <input type="number" class="form-input" id="f-prod-margin" value="${data.margin_persen || 0}" readonly style="background:var(--bg-elevated); cursor:not-allowed;" title="Dihitung otomatis oleh sistem berdasar Harga Jual dan HPP">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">HPP (auto dari resep)</label>
        <input type="number" class="form-input" id="f-prod-hpp" value="${data.hpp || 0}" readonly style="background:var(--bg-elevated); cursor:not-allowed;">
        <span class="form-hint">Otomatis dihitung dari halaman HPP</span>
      </div>
      <div class="form-group">
        <label class="form-label">Harga Jual</label>
        <input type="number" class="form-input" id="f-prod-harga" value="${data.harga_jual || 0}" min="0" step="100">
      </div>
    </div>
  `;
}

export async function initProducts() {
  await loadData();

  document.getElementById('btn-add-product')?.addEventListener('click', async () => {
    const result = await openModal('Tambah Produk Baru', productFormHtml(), {
      confirmText: 'Simpan',
      onConfirm: () => ({
        nama: document.getElementById('f-prod-nama').value,
        category_id: document.getElementById('f-prod-category').value,
        satuan: document.getElementById('f-prod-satuan').value,
        harga_jual: Number(document.getElementById('f-prod-harga').value),
      })
    });
    if (result && result.nama) {
      try {
        await api.createProduct(result);
        notify.success('Produk berhasil ditambahkan');
        await loadData();
      } catch (err) {
        notify.error('Gagal menambah produk: ' + err.message);
      }
    }
  });

  document.getElementById('product-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    
    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      const product = products.find(p => p.id === id);
      if (confirm(`Apakah Anda yakin ingin menghapus produk "${product?.nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
        try {
          await api.deleteProduct(id);
          notify.success('Produk berhasil dihapus');
          await loadData();
        } catch (err) {
          notify.error('Gagal menghapus produk: ' + (err.message.includes('foreign key') ? 'Produk ini masih memiliki data transaksi atau stok yang terikat!' : err.message));
        }
      }
      return;
    }

    if (!editBtn) return;
    const id = editBtn.dataset.edit;
      const product = products.find(p => p.id === id);
      if (!product) return;

      const result = await openModal('Edit Produk', productFormHtml(product), {
        confirmText: 'Perbarui',
        onConfirm: () => ({
          nama: document.getElementById('f-prod-nama').value,
          category_id: document.getElementById('f-prod-category').value,
          satuan: document.getElementById('f-prod-satuan').value,
          harga_jual: Number(document.getElementById('f-prod-harga').value),
        })
      });
      if (result && result.nama) {
        try {
          await api.updateProduct(id, result);
          notify.success('Produk berhasil diperbarui');
          await loadData();
        } catch (err) {
          notify.error('Gagal update produk: ' + err.message);
        }
      }
  });

  document.getElementById('product-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = products.filter(p => p.nama.toLowerCase().includes(q));
    renderProductRows(filtered);
  });
}
