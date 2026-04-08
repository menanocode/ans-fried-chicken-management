import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { openModal } from '../components/modal.js';
import { formatRupiah, escapeHtml } from '../utils/helpers.js';

let ingredients = [];
let products = [];
let hppConfig = null;

export function renderHpp() {
  return `
    <div class="page-header">
      <div>
        <h2>HPP & Harga Jual</h2>
        <p>Kelola harga bahan baku dan kalkulasi HPP</p>
      </div>
    </div>

    <div class="tabs" id="hpp-tabs">
      <button class="tab active" data-tab="ingredients">🧂 Bahan Baku</button>
      <button class="tab" data-tab="products">💰 HPP & Harga Produk</button>
      <button class="tab" data-tab="config">⚙️ Konfigurasi HPP (Overhead dll)</button>
    </div>

    <div id="tab-ingredients">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: var(--sp-4);">
        <h3>Daftar Bahan Baku</h3>
        <button class="btn btn-primary btn-sm" id="btn-add-ingredient">
          <span class="material-icons-round">add</span> Tambah Bahan
        </button>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Nama Bahan</th>
              <th>Harga per Unit</th>
              <th>Satuan</th>
              <th style="width:80px;">Aksi</th>
            </tr>
          </thead>
          <tbody id="ingredients-tbody">
            <tr><td colspan="4"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="tab-products" style="display:none;">
      <div class="alert-box alert-info mb-4">
        <span class="material-icons-round">info</span>
        <div>HPP dihitung otomatis berdasarkan resep produk. Harga jual = HPP × (1 + margin%). Anda bisa set resep di halaman ini.</div>
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>Produk</th>
              <th>HPP</th>
              <th>Margin</th>
              <th>Harga Jual</th>
              <th>Profit/Item</th>
              <th style="width:100px;">Aksi</th>
            </tr>
          </thead>
          <tbody id="hpp-tbody">
            <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div id="tab-config" style="display:none;">
      <div class="alert-box alert-info mb-4">
        <span class="material-icons-round">info</span>
        <div>Konfigurasi ini digunakan untuk membagi biaya bulanan (tenaga kerja, overhead, pemasaran, administrasi, dll) ke dalam HPP per produk berdasarkan target volume produksi dan penjualan.</div>
      </div>
      <form id="hpp-config-form" class="card">
        <div id="hpp-config-container"><div class="loading-spinner"><div class="spinner"></div></div></div>
      </form>
    </div>
  `;
}

function renderIngredientsTable(data) {
  const tbody = document.getElementById('ingredients-tbody');
  tbody.innerHTML = data.map(i => `
    <tr>
      <td><strong>${escapeHtml(i.nama)}</strong></td>
      <td>${formatRupiah(i.harga_per_unit)}</td>
      <td>${i.satuan}</td>
      <td>
        <div class="btn-group">
          <button class="btn btn-ghost btn-sm" data-edit-ing="${i.id}" title="Edit">
            <span class="material-icons-round">edit</span>
          </button>
          <button class="btn btn-ghost btn-sm text-danger" data-delete-ing="${i.id}" title="Hapus">
            <span class="material-icons-round">delete</span>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function renderHppTable(data) {
  const tbody = document.getElementById('hpp-tbody');
  tbody.innerHTML = data.map(p => {
    const profit = Number(p.harga_jual) - Number(p.hpp);
    return `
      <tr>
        <td>
          <strong>${escapeHtml(p.nama)}</strong>
          <div style="font-size: var(--font-xs); color: var(--text-muted);">${p.categories?.nama || ''}</div>
        </td>
        <td>${formatRupiah(p.hpp)}</td>
        <td><span class="badge badge-orange">${p.margin_persen}%</span></td>
        <td><strong style="color: var(--success);">${formatRupiah(p.harga_jual)}</strong></td>
        <td style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 600;">${formatRupiah(profit)}</td>
        <td>
          <div class="btn-group">
            <button class="btn btn-ghost btn-sm" data-edit-hpp="${p.id}" title="Edit Margin">
              <span class="material-icons-round">edit</span>
            </button>
            <button class="btn btn-ghost btn-sm" data-recipe="${p.id}" title="Resep">
              <span class="material-icons-round">receipt</span>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderHppConfig(config) {
  const container = document.getElementById('hpp-config-container');
  if (!config) {
    container.innerHTML = `<div class="empty-state"><span class="material-icons-round">build</span><h3>Belum Ada Konfigurasi</h3><p>Data konfigurasi HPP belum tersedia.</p></div>`;
    return;
  }
  
  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: var(--sp-6);">
      <div>
        <h4 style="margin-bottom: var(--sp-4); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--border-color);">🎯 Target Bulanan</h4>
        <div class="form-group"><label class="form-label">Target Produksi (Produk)</label><input type="number" class="form-input" id="cfg-produksi" value="${config.jumlah_produksi_per_bulan}"></div>
        <div class="form-group"><label class="form-label">Target Penjualan (Produk)</label><input type="number" class="form-input" id="cfg-terjual" value="${config.jumlah_terjual_per_bulan}"></div>
      </div>
      <div>
        <h4 style="margin-bottom: var(--sp-4); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--border-color);">👷 Tenaga Kerja Langsung</h4>
        <div class="form-group"><label class="form-label">Total Gaji Produksi/Bulan (Rp)</label><input type="number" class="form-input" id="cfg-gaji-prod" value="${config.gaji_produksi_per_bulan}"></div>
      </div>
      <div>
        <h4 style="margin-bottom: var(--sp-4); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--border-color);">🏭 Overhead Operasional</h4>
        <div class="form-group"><label class="form-label">Listrik (Rp)</label><input type="number" class="form-input" id="cfg-listrik" value="${config.biaya_listrik}"></div>
        <div class="form-group"><label class="form-label">Gas/BBM (Rp)</label><input type="number" class="form-input" id="cfg-gas" value="${config.biaya_gas_bahan_bakar}"></div>
        <div class="form-group"><label class="form-label">Sewa Tempat (Rp)</label><input type="number" class="form-input" id="cfg-sewa" value="${config.biaya_sewa_tempat}"></div>
        <div class="form-group"><label class="form-label">Perawatan Mesin (Rp)</label><input type="number" class="form-input" id="cfg-perawatan" value="${config.biaya_perawatan_mesin}"></div>
        <div class="form-group"><label class="form-label">Distribusi (Rp)</label><input type="number" class="form-input" id="cfg-distribusi" value="${config.biaya_distribusi}"></div>
        <div class="form-group"><label class="form-label">Lain-lain (Rp)</label><input type="number" class="form-input" id="cfg-overhead-lain" value="${config.biaya_overhead_lain}"></div>
      </div>
      <div>
        <h4 style="margin-bottom: var(--sp-4); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--border-color);">📈 Pemasaran</h4>
        <div class="form-group"><label class="form-label">Promosi (Rp)</label><input type="number" class="form-input" id="cfg-promosi" value="${config.biaya_promosi}"></div>
        <div class="form-group"><label class="form-label">Iklan (Rp)</label><input type="number" class="form-input" id="cfg-iklan" value="${config.biaya_iklan}"></div>
        <div class="form-group"><label class="form-label">Lain-lain (Rp)</label><input type="number" class="form-input" id="cfg-pemasaran-lain" value="${config.biaya_pemasaran_lain}"></div>
      </div>
      <div>
        <h4 style="margin-bottom: var(--sp-4); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--border-color);">🏢 Administrasi & Umum</h4>
        <div class="form-group"><label class="form-label">Gaji Admin (Rp)</label><input type="number" class="form-input" id="cfg-gaji-admin" value="${config.gaji_admin}"></div>
        <div class="form-group"><label class="form-label">Peralatan Kantor (Rp)</label><input type="number" class="form-input" id="cfg-peralatan" value="${config.biaya_peralatan_kantor}"></div>
        <div class="form-group"><label class="form-label">Komunikasi (Rp)</label><input type="number" class="form-input" id="cfg-komunikasi" value="${config.biaya_komunikasi}"></div>
        <div class="form-group"><label class="form-label">Lain-lain (Rp)</label><input type="number" class="form-input" id="cfg-admin-lain" value="${config.biaya_admin_lain}"></div>
      </div>
      <div>
        <h4 style="margin-bottom: var(--sp-4); padding-bottom: var(--sp-2); border-bottom: 1px solid var(--border-color);">🏦 Pajak & Iuran</h4>
        <div class="form-group"><label class="form-label">Persentase Pajak / PPN (%)</label><input type="number" class="form-input" id="cfg-pajak" value="${config.persentase_pajak}" step="0.1"></div>
        <div class="form-group"><label class="form-label">Iuran Lain/Bulan (Rp)</label><input type="number" class="form-input" id="cfg-iuran" value="${config.biaya_iuran_lain}"></div>
      </div>
    </div>
    <div style="margin-top: var(--sp-6); display: flex; justify-content: flex-end;">
      <button type="submit" class="btn btn-primary" id="btn-save-config">Simpan & Hitung Ulang HPP</button>
    </div>
  `;
}

async function loadData() {
  try {
    [ingredients, products, hppConfig] = await Promise.all([
      api.getIngredients(),
      api.getProducts(),
      api.getHppConfig()
    ]);
    renderIngredientsTable(ingredients);
    renderHppTable(products);
    renderHppConfig(hppConfig);
  } catch (err) {
    notify.error('Gagal memuat data: ' + err.message);
  }
}

export async function initHpp() {
  await loadData();

  // Tab switching
  document.querySelectorAll('#hpp-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#hpp-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById('tab-ingredients').style.display = tabName === 'ingredients' ? '' : 'none';
      document.getElementById('tab-products').style.display = tabName === 'products' ? '' : 'none';
      document.getElementById('tab-config').style.display = tabName === 'config' ? '' : 'none';
    });
  });

  // Save HPP Config
  document.getElementById('hpp-config-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const updates = {
      jumlah_produksi_per_bulan: Number(document.getElementById('cfg-produksi').value),
      jumlah_terjual_per_bulan: Number(document.getElementById('cfg-terjual').value),
      gaji_produksi_per_bulan: Number(document.getElementById('cfg-gaji-prod').value),
      biaya_listrik: Number(document.getElementById('cfg-listrik').value),
      biaya_gas_bahan_bakar: Number(document.getElementById('cfg-gas').value),
      biaya_sewa_tempat: Number(document.getElementById('cfg-sewa').value),
      biaya_perawatan_mesin: Number(document.getElementById('cfg-perawatan').value),
      biaya_distribusi: Number(document.getElementById('cfg-distribusi').value),
      biaya_overhead_lain: Number(document.getElementById('cfg-overhead-lain').value),
      biaya_promosi: Number(document.getElementById('cfg-promosi').value),
      biaya_iklan: Number(document.getElementById('cfg-iklan').value),
      biaya_pemasaran_lain: Number(document.getElementById('cfg-pemasaran-lain').value),
      gaji_admin: Number(document.getElementById('cfg-gaji-admin').value),
      biaya_peralatan_kantor: Number(document.getElementById('cfg-peralatan').value),
      biaya_komunikasi: Number(document.getElementById('cfg-komunikasi').value),
      biaya_admin_lain: Number(document.getElementById('cfg-admin-lain').value),
      persentase_pajak: Number(document.getElementById('cfg-pajak').value),
      biaya_iuran_lain: Number(document.getElementById('cfg-iuran').value),
    };

    const btn = document.getElementById('btn-save-config');
    const oldText = btn.innerHTML;
    btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;margin-right:8px;"></span> Menyimpan...';
    btn.disabled = true;

    try {
      await api.updateHppConfig(hppConfig?.id, updates);
      notify.success('Konfigurasi HPP berhasil diperbarui. HPP produk akan dihitung ulang secara perlahan di background (oleh database trigger).');
      await loadData();
    } catch (err) {
      notify.error('Gagal menyimpan: ' + err.message);
    } finally {
      btn.innerHTML = oldText;
      btn.disabled = false;
    }
  });

  // Add ingredient
  document.getElementById('btn-add-ingredient')?.addEventListener('click', async () => {
    const result = await openModal('Tambah Bahan Baku', `
      <div class="form-group">
        <label class="form-label">Nama Bahan</label>
        <input type="text" class="form-input" id="f-ing-nama" placeholder="Contoh: Ayam Potong">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Harga per Unit (Rp)</label>
          <input type="number" class="form-input" id="f-ing-harga" value="0" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Satuan</label>
          <input type="text" class="form-input" id="f-ing-satuan" placeholder="kg, liter, pcs">
        </div>
      </div>
    `, {
      confirmText: 'Simpan',
      onConfirm: () => ({
        nama: document.getElementById('f-ing-nama').value,
        harga_per_unit: Number(document.getElementById('f-ing-harga').value),
        satuan: document.getElementById('f-ing-satuan').value,
      })
    });
    if (result && result.nama) {
      try {
        await api.createIngredient(result);
        notify.success('Bahan baku ditambahkan');
        await loadData();
      } catch (err) { notify.error(err.message); }
    }
  });

  // Edit/Delete ingredient
  document.getElementById('ingredients-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-ing]');
    const deleteBtn = e.target.closest('[data-delete-ing]');
    
    if (deleteBtn) {
      const id = deleteBtn.dataset.deleteIng;
      const ing = ingredients.find(i => i.id === id);
      if (confirm(`Apakah Anda yakin ingin menghapus bahan "${ing?.nama}"? Tindakan ini tidak dapat dibatalkan.`)) {
        try {
          await api.deleteIngredient(id);
          notify.success('Bahan baku berhasil dihapus');
          await loadData();
        } catch (err) {
          notify.error('Gagal menghapus bahan: ' + (err.message.includes('foreign key') ? 'Bahan ini masih digunakan dalam resep produk!' : err.message));
        }
      }
      return;
    }

    if (!editBtn) return;
    const ing = ingredients.find(i => i.id === editBtn.dataset.editIng);
    if (!ing) return;

    const result = await openModal('Edit Bahan Baku', `
      <div class="form-group">
        <label class="form-label">Nama Bahan</label>
        <input type="text" class="form-input" id="f-ing-nama" value="${escapeHtml(ing.nama)}">
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Harga per Unit (Rp)</label>
          <input type="number" class="form-input" id="f-ing-harga" value="${ing.harga_per_unit}" min="0">
        </div>
        <div class="form-group">
          <label class="form-label">Satuan</label>
          <input type="text" class="form-input" id="f-ing-satuan" value="${ing.satuan}">
        </div>
      </div>
    `, {
      confirmText: 'Perbarui',
      onConfirm: () => ({
        nama: document.getElementById('f-ing-nama').value,
        harga_per_unit: Number(document.getElementById('f-ing-harga').value),
        satuan: document.getElementById('f-ing-satuan').value,
      })
    });
    if (result) {
      try {
        await api.updateIngredient(ing.id, result);
        notify.success('Bahan baku diperbarui (HPP akan terhitung ulang)');
        await loadData();
      } catch (err) { notify.error(err.message); }
    }
  });

  // Edit product margin/price
  document.getElementById('hpp-tbody')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit-hpp]');
    const recipeBtn = e.target.closest('[data-recipe]');

    if (editBtn) {
      const prod = products.find(p => p.id === editBtn.dataset.editHpp);
      if (!prod) return;

      const result = await openModal(`Harga: ${prod.nama}`, `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">HPP (Rp)</label>
            <input type="number" class="form-input" id="f-hpp" value="${prod.hpp}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Margin (%)</label>
            <input type="number" class="form-input" id="f-margin" value="${prod.margin_persen}" min="0">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Harga Jual (Rp)</label>
          <input type="number" class="form-input" id="f-harga-jual" value="${prod.harga_jual}" min="0">
          <span class="form-hint">Auto: HPP × (1 + margin%)</span>
        </div>
      `, {
        confirmText: 'Perbarui',
        onOpen: (modal) => {
          const hppInput = modal.querySelector('#f-hpp');
          const marginInput = modal.querySelector('#f-margin');
          const hargaInput = modal.querySelector('#f-harga-jual');
          const calc = () => {
            const hpp = Number(hppInput.value);
            const margin = Number(marginInput.value);
            hargaInput.value = Math.round(hpp * (1 + margin / 100));
          };
          hppInput.addEventListener('input', calc);
          marginInput.addEventListener('input', calc);
        },
        onConfirm: () => ({
          hpp: Number(document.getElementById('f-hpp').value),
          margin_persen: Number(document.getElementById('f-margin').value),
          harga_jual: Number(document.getElementById('f-harga-jual').value),
        })
      });
      if (result) {
        try {
          await api.updateProduct(prod.id, result);
          notify.success('Harga produk diperbarui');
          await loadData();
        } catch (err) { notify.error(err.message); }
      }
    }

    if (recipeBtn) {
      const prodId = recipeBtn.dataset.recipe;
      const prod = products.find(p => p.id === prodId);
      if (!prod) return;

      const renderModalContent = async (container) => {
        try {
          container.innerHTML = '<div style="padding: 20px; text-align: center;"><div class="spinner" style="display:inline-block;"></div></div>';
          const [recipes, hppFull] = await Promise.all([
            api.getRecipes(prodId),
            api.getFullHppBreakdown(prodId)
          ]);

          const totalBahan = recipes.reduce((sum, r) => sum + (Number(r.ingredients?.harga_per_unit || 0) * Number(r.jumlah_per_produk)), 0);

          let breakdownHtml = '';
          if (hppFull && hppFull.hpp_total) {
            breakdownHtml = `
              <div style="margin-top: var(--sp-6); background: var(--surface-hover); padding: var(--sp-4); border-radius: var(--radius-md); border: 1px solid var(--border-color);">
                <h4 style="margin-bottom: var(--sp-3); font-size: var(--font-md);">📊 Rincian Total HPP Profesional</h4>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Bahan Baku Langsung:</span> <strong>${formatRupiah(hppFull.biaya_bahan_baku)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Tenaga Kerja Langsung:</span> <strong>${formatRupiah(hppFull.biaya_tenaga_kerja)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Overhead Operasional:</span> <strong>${formatRupiah(hppFull.biaya_overhead)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Biaya Pemasaran:</span> <strong>${formatRupiah(hppFull.biaya_pemasaran)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Biaya Administrasi:</span> <strong>${formatRupiah(hppFull.biaya_administrasi)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-bottom: 4px;"><span>Estimasi Pajak (PPN):</span> <strong>${formatRupiah(hppFull.biaya_pajak)}</strong></div>
                <div style="display:flex; justify-content:space-between; margin-top: 8px; padding-top: 8px; border-top: 1px dashed var(--border-color); font-size: var(--font-lg);">
                  <span><strong>HPP Total (Per Produk):</strong></span>
                  <strong style="color: var(--primary);">${formatRupiah(hppFull.hpp_total)}</strong>
                </div>
              </div>
            `;
          }

          container.innerHTML = `
            <p style="color: var(--text-muted); font-size: var(--font-sm); margin-bottom: var(--sp-4);">
              Bahan baku yang digunakan untuk membuat 1 ${prod.satuan} <strong>${prod.nama}</strong>:
            </p>
            ${recipes.length ? `
              <table style="width:100%; margin-bottom: var(--sp-4);">
                <thead><tr><th>Bahan</th><th>Jumlah</th><th>Satuan</th><th>Biaya</th><th style="width: 40px; text-align: center;">Hapus</th></tr></thead>
                <tbody>
                  ${recipes.map(r => `
                    <tr>
                      <td>${r.ingredients?.nama || '-'}</td>
                      <td>${r.jumlah_per_produk}</td>
                      <td>${r.ingredients?.satuan || ''}</td>
                      <td>${formatRupiah(Number(r.ingredients?.harga_per_unit || 0) * Number(r.jumlah_per_produk))}</td>
                      <td style="text-align: center;">
                        <button type="button" class="btn btn-ghost btn-sm text-danger" data-del-product="${r.product_id}" data-del-ingredient="${r.ingredient_id}" style="padding: 4px;" title="Hapus Tanpa Konfirmasi">
                          <span class="material-icons-round" style="font-size: 18px;">delete</span>
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
                <tfoot>
                  <tr>
                    <td colspan="3" style="text-align:right;"><strong>Subtotal Bahan:</strong></td>
                    <td><strong>${formatRupiah(totalBahan)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            ` : '<p style="color: var(--text-muted);">Belum ada resep</p>'}
            ${breakdownHtml}
            <hr style="border-color: var(--border-color); margin: var(--sp-4) 0;">
            <h4 style="margin-bottom: var(--sp-3);">Tambah/Update Bahan</h4>
            <div class="form-row">
              <div class="form-group" style="flex:2;">
                <label class="form-label">Bahan</label>
                <select class="form-select" id="f-recipe-ing">
                  ${ingredients.map(i => `<option value="${i.id}">${i.nama} (${formatRupiah(i.harga_per_unit)}/${i.satuan})</option>`).join('')}
                </select>
              </div>
              <div class="form-group" style="flex:1;">
                <label class="form-label">Jumlah</label>
                <input type="number" class="form-input" id="f-recipe-qty" value="0.1" min="0" step="0.0001">
              </div>
            </div>
            <div style="margin-top: var(--sp-4); text-align: right;">
              <button type="button" class="btn btn-primary" id="btn-add-recipe-ing">Tambah Bahan</button>
            </div>
          `;

          // Delete without confirmation
          container.querySelectorAll('[data-del-product]').forEach(btn => {
            btn.addEventListener('click', async () => {
              const pId = btn.dataset.delProduct;
              const iId = btn.dataset.delIngredient;
              try {
                btn.disabled = true;
                btn.style.opacity = '0.5';
                await api.deleteRecipe(pId, iId);
                notify.success('Bahan dihapus.');
                await renderModalContent(container);
                loadData(); // Background reload main page data
              } catch (err) {
                btn.disabled = false;
                btn.style.opacity = '1';
                notify.error('Gagal menghapus: ' + err.message);
              }
            });
          });

          // Add material inside the modal
          const addBtn = container.querySelector('#btn-add-recipe-ing');
          if (addBtn) {
            addBtn.addEventListener('click', async () => {
              const result = {
                product_id: prodId,
                ingredient_id: document.getElementById('f-recipe-ing').value,
                jumlah_per_produk: Number(document.getElementById('f-recipe-qty').value),
              };
              try {
                addBtn.disabled = true;
                addBtn.innerHTML = '<span class="spinner" style="width: 16px; height: 16px; border-width: 2px; margin-right: 8px;"></span> Menyimpan...';
                await api.upsertRecipe(result);
                notify.success('Bahan ditambahkan.');
                await renderModalContent(container);
                loadData(); // Background reload main page data
              } catch (err) {
                addBtn.disabled = false;
                addBtn.innerHTML = 'Tambah Bahan';
                notify.error(err.message);
              }
            });
          }
        } catch (err) {
          container.innerHTML = `<p class="text-danger" style="margin-top:20px;">Gagal memuat resep: ${err.message}</p>`;
        }
      };

      openModal(`Resep: ${prod.nama}`, '<div id="recipe-modal-content"></div>', {
        confirmText: false,
        size: 'lg',
        onOpen: (modal) => {
          renderModalContent(modal.querySelector('#recipe-modal-content'));
        }
      });
    }
  });
}
