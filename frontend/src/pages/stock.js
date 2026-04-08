import { auth } from '../services/auth.js';
import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { openModal } from '../components/modal.js';
import { stockLevel, stockPercent, escapeHtml } from '../utils/helpers.js';

let stocks = [];
let currentView = 'gudang'; // 'gudang' | 'outlet'

export function renderStock() {
  const isOutlet = auth.isOutlet();
  return `
    <div class="page-header">
      <div>
        <h2>${isOutlet ? 'Stok Outlet' : 'Manajemen Stok'}</h2>
        <p>${isOutlet ? 'Pantau persediaan bahan di outlet Anda' : 'Pantau persediaan gudang pusat dan seluruh outlet'}</p>
      </div>
      <button class="btn btn-secondary" id="btn-refresh-stock">
        <span class="material-icons-round">refresh</span> Refresh
      </button>
    </div>
    
    ${!isOutlet ? `
      <div class="tabs" id="stock-view-tabs">
        <button class="tab active" data-view="gudang">Stok Gudang Pusat</button>
        <button class="tab" data-view="outlet">Stok Semua Outlet</button>
      </div>
    ` : ''}

    <div class="stats-grid stagger" id="stock-summary"></div>
    
    <div class="table-wrapper">
      <div class="table-toolbar">
        <div class="table-search">
          <span class="material-icons-round">search</span>
          <input type="text" class="form-input" id="stock-search" placeholder="Cari otomatis...">
        </div>
      </div>
      <div id="stock-table-container">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    </div>
  `;
}

function updateSummary(data) {
    const total = data.reduce((s, i) => s + i.stok_tersedia, 0);
    const critical = data.filter(s => s.stok_tersedia <= (s.stok_minimum || 50)).length;
    const warning = data.filter(s => s.stok_tersedia > (s.stok_minimum || 50) && s.stok_tersedia <= (s.stok_minimum || 50) * 1.5).length;

    document.getElementById('stock-summary').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon orange"><span class="material-icons-round">inventory_2</span></div>
        <div class="stat-info">
          <div class="stat-label">Total Item</div>
          <div class="stat-value">${data.length}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><span class="material-icons-round">all_inclusive</span></div>
        <div class="stat-info">
          <div class="stat-label">Total Stok</div>
          <div class="stat-value">${total.toLocaleString('id-ID')}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon red"><span class="material-icons-round">error</span></div>
        <div class="stat-info">
          <div class="stat-label">Kritis</div>
          <div class="stat-value">${critical}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon yellow"><span class="material-icons-round">warning</span></div>
        <div class="stat-info">
          <div class="stat-label">Peringatan</div>
          <div class="stat-value">${warning}</div>
        </div>
      </div>
    `;
}

function renderGudangRows(data) {
  const tableContainer = document.getElementById('stock-table-container');
  const tableHtml = `
    <table>
      <thead>
        <tr>
          <th>Produk</th>
          <th>Kategori</th>
          <th>Stok Tersedia</th>
          <th>Level Stok</th>
          <th>Stok Minimum</th>
          ${!auth.isOutlet() && currentView === 'gudang' ? '<th style="width:80px;">Aksi</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${data.length === 0 ? `<tr><td colspan="6"><div class="table-empty"><span class="material-icons-round">inventory_2</span><p>Belum ada data stok</p></div></td></tr>` : 
          data.map(s => {
            const min = s.stok_minimum || 50;
            const level = stockLevel(s.stok_tersedia, min);
            const pct = stockPercent(s.stok_tersedia, min);
            return `
              <tr>
                <td><strong>${escapeHtml(s.products?.nama || '-')}</strong></td>
                <td><span class="badge badge-orange">${s.products?.categories?.icon || '📦'} ${s.products?.categories?.nama || '-'}</span></td>
                <td>
                  <span style="font-weight:700; font-size: var(--font-md); ${level === 'stock-critical' ? 'color: var(--danger);' : level === 'stock-warning' ? 'color: var(--warning);' : 'color: var(--success);'}">
                    ${s.stok_tersedia}
                  </span>
                  <span style="color: var(--text-muted); font-size: var(--font-xs);"> ${s.products?.satuan || ''}</span>
                </td>
                <td style="min-width: 140px;">
                  <div class="${level}">
                    <div class="stock-bar">
                      <div class="stock-bar-fill" style="width: ${pct}%"></div>
                    </div>
                  </div>
                </td>
                <td>${min}</td>
                ${!auth.isOutlet() && currentView === 'gudang' ? `
                <td>
                  <button class="btn btn-ghost btn-sm" data-edit="${s.id}" data-current="${s.stok_tersedia}" data-min="${min}" data-name="${escapeHtml(s.products?.nama || '')}">
                    <span class="material-icons-round">edit</span>
                  </button>
                </td>
                ` : ''}
              </tr>
            `;
          }).join('')
        }
      </tbody>
    </table>
  `;
  tableContainer.innerHTML = tableHtml;
  updateSummary(data);
}

// Helper: format product name vertically (one word per line)
function formatProductHeader(name) {
  const variantMatch = name.match(/\(([^)]+)\)$/);
  const baseName = name.replace(/\s*\([^)]+\)$/, '').trim();
  const words = baseName.split(/\s+/);
  let html = words.map(w => `<div>${escapeHtml(w)}</div>`).join('');
  if (variantMatch) {
    html += `<div style="color: var(--primary); font-weight: 700;">(${escapeHtml(variantMatch[1])})</div>`;
  }
  return html;
}

// Helper: pick an icon based on the product name keywords
function getProductIcon(name) {
  const n = name.toLowerCase();
  if (n.includes('dada'))        return { icon: 'restaurant_menu', color: 'var(--warning)' };
  if (n.includes('paha atas'))   return { icon: 'lunch_dining',    color: 'var(--success)' };
  if (n.includes('paha'))        return { icon: 'dinner_dining',   color: '#4fc3f7' };
  if (n.includes('sayap'))       return { icon: 'kebab_dining',    color: '#ba68c8' };
  if (n.includes('spicy'))       return { icon: 'local_fire_department', color: 'var(--danger)' };
  if (n.includes('ayam'))        return { icon: 'set_meal',        color: 'var(--warning)' };
  if (n.includes('air') || n.includes('mineral')) return { icon: 'water_drop', color: '#4fc3f7' };
  if (n.includes('es') || n.includes('milo') || n.includes('jeruk') || n.includes('teh') || n.includes('kopi'))
                                 return { icon: 'local_cafe',      color: '#a1887f' };
  if (n.includes('nasi'))        return { icon: 'rice_bowl',       color: '#fff176' };
  if (n.includes('sambal') || n.includes('saus'))  return { icon: 'soup_kitchen', color: 'var(--danger)' };
  return { icon: 'inventory_2', color: 'var(--text-muted)' };
}

function renderPivotTable(data) {
  if (!data || !data.length) {
    document.getElementById('stock-table-container').innerHTML = `<div class="table-empty"><p>Belum ada data stok outlet</p></div>`;
    return;
  }

  const productMap = new Map();
  const outletMap = new Map();

  data.forEach(item => {
    if (item.products) {
       productMap.set(item.product_id, item.products.nama);
    }
    if (item.outlets) {
       if (!outletMap.has(item.outlet_id)) {
          outletMap.set(item.outlet_id, {
             nama: item.outlets.nama,
             alamat: item.outlets.alamat || '-',
             stok: {}
          });
       }
       outletMap.get(item.outlet_id).stok[item.product_id] = item.stok_tersedia;
    }
  });

  const products = Array.from(productMap.entries()).map(([id, nama]) => ({id, nama}));
  const outlets = Array.from(outletMap.values());

  const tableHtml = `
    <div style="overflow-x: auto;">
      <table style="border-collapse: collapse;">
        <thead>
          <tr>
            <th style="position: sticky; left: 0; z-index: 2; background: var(--bg-card); min-width: 140px; vertical-align: bottom; white-space: normal;">Nama Outlet</th>
            <th style="min-width: 180px; vertical-align: bottom; white-space: normal;">Alamat</th>
            ${products.map(p => {
              const pi = getProductIcon(p.nama);
              return `<th style="vertical-align: bottom; white-space: normal; text-align: center; padding: 10px 6px; min-width: 70px; line-height: 1.25; font-size: var(--font-xs);">
                <span class="material-icons-round" style="font-size: 1.3rem; color: ${pi.color}; display: block; margin: 0 auto 4px;">${pi.icon}</span>
                ${formatProductHeader(p.nama)}
              </th>`;
            }).join('')}
          </tr>
        </thead>
        <tbody>
          ${outlets.map(o => `
            <tr>
              <td style="position: sticky; left: 0; background: var(--bg-card); z-index: 1; white-space: normal;"><strong>${escapeHtml(o.nama)}</strong></td>
              <td style="white-space: normal;"><span style="font-size: var(--font-xs); color: var(--text-muted);">${escapeHtml(o.alamat)}</span></td>
              ${products.map(p => {
                const qty = o.stok[p.id] || 0;
                return `<td style="text-align: center;"><span style="font-weight: 600; ${qty < 10 ? 'color: var(--danger);' : ''}">${qty}</span></td>`;
              }).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  
  document.getElementById('stock-table-container').innerHTML = tableHtml;

  document.getElementById('stock-summary').innerHTML = `
      <div class="stat-card">
        <div class="stat-icon blue"><span class="material-icons-round">storefront</span></div>
        <div class="stat-info">
          <div class="stat-label">Total Outlet Dipantau</div>
          <div class="stat-value">${outlets.length}</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon orange"><span class="material-icons-round">category</span></div>
        <div class="stat-info">
          <div class="stat-label">Variasi Produk</div>
          <div class="stat-value">${products.length}</div>
        </div>
      </div>
  `;
}

async function loadStock() {
  try {
    const tableContainer = document.getElementById('stock-table-container');
    if (tableContainer) {
      tableContainer.innerHTML = `<div class="loading-spinner"><div class="spinner"></div></div>`;
    }

    if (auth.isOutlet()) {
      stocks = await api.getOutletStock(auth.getOutletId());
      renderGudangRows(stocks);
    } else {
      if (currentView === 'outlet') {
        stocks = await api.getOutletStock(); // Get all outlets
        renderPivotTable(stocks);
      } else {
        stocks = await api.getWarehouseStock();
        renderGudangRows(stocks);
      }
    }
  } catch (err) {
    notify.error('Gagal memuat stok: ' + err.message);
  }
}

export async function initStock() {
  await loadStock();

  document.getElementById('btn-refresh-stock')?.addEventListener('click', loadStock);

  document.getElementById('stock-view-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab');
    if (tab) {
      document.querySelectorAll('#stock-view-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      currentView = tab.dataset.view;
      loadStock();
    }
  });

  const tableContainer = document.getElementById('stock-table-container');
  tableContainer?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn && currentView === 'gudang') {
      const { id, current, min, name } = editBtn.dataset;
      const result = await openModal(`Update Stok: ${name}`, `
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Stok Tersedia</label>
            <input type="number" class="form-input" id="f-stok" value="${current}" min="0">
          </div>
          <div class="form-group">
            <label class="form-label">Stok Minimum</label>
            <input type="number" class="form-input" id="f-min" value="${min}" min="0">
          </div>
        </div>
      `, {
        confirmText: 'Update',
        onConfirm: () => ({
          stok_tersedia: Number(document.getElementById('f-stok').value),
          stok_minimum: Number(document.getElementById('f-min').value),
        })
      });
      if (result) {
        try {
          await api.updateWarehouseStock(id, result);
          notify.success('Stok berhasil diperbarui');
          await loadStock();
        } catch (err) {
          notify.error('Gagal update stok: ' + err.message);
        }
      }
    }
  });

  document.getElementById('stock-search')?.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    if (currentView === 'outlet') {
       const filtered = stocks.filter(s => 
          s.outlets?.nama?.toLowerCase().includes(q) || 
          s.products?.nama?.toLowerCase().includes(q)
       );
       renderPivotTable(filtered);
    } else {
       const filtered = stocks.filter(s => s.products?.nama?.toLowerCase().includes(q));
       renderGudangRows(filtered);
    }
  });
}
