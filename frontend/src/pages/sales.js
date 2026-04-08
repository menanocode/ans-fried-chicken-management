import { auth } from '../services/auth.js';
import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { openModal } from '../components/modal.js';
import { formatRupiah, formatDate, toISODate, escapeHtml } from '../utils/helpers.js';

let sales = [];
let products = [];
let outlets = [];

export function renderSales() {
  const isOutlet = auth.isOutlet();
  return `
    <div class="page-header">
      <div>
        <h2>Penjualan</h2>
        <p>${isOutlet ? 'Catat penjualan harian outlet Anda' : 'Data penjualan semua outlet'}</p>
      </div>
      ${(isOutlet || auth.isAdmin()) ? `
        <button class="btn btn-primary" id="btn-new-sale">
          <span class="material-icons-round">add</span> Catat Penjualan
        </button>
      ` : ''}
    </div>
    <div class="filter-bar">
      ${!isOutlet ? `
        <select class="form-select" id="filter-outlet">
          <option value="">Semua Outlet</option>
        </select>
      ` : ''}
      <input type="date" class="form-input" id="filter-date-from" value="${toISODate(new Date(Date.now() - 30 * 86400000))}">
      <input type="date" class="form-input" id="filter-date-to" value="${toISODate(new Date())}">
      <button class="btn btn-secondary" id="btn-filter-sales">
        <span class="material-icons-round">filter_list</span> Filter
      </button>
    </div>
    <div class="stats-grid stagger" id="sales-summary"></div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Outlet</th>
            <th>Tanggal</th>
            <th>Items</th>
            <th>Total</th>
            <th>Dicatat oleh</th>
          </tr>
        </thead>
        <tbody id="sales-tbody">
          <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderSalesRows(data) {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return; // Prevent error if user navigated away before data loaded
  
  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><span class="material-icons-round">point_of_sale</span><p>Belum ada data penjualan</p></div></td></tr>`;
    return;
  }
  tbody.innerHTML = data.map(s => `
    <tr>
      <td><strong style="color: var(--orange-400);">${s.sale_code || '-'}</strong></td>
      <td>${s.outlets?.nama || '-'}</td>
      <td>${formatDate(s.tanggal)}</td>
      <td>${(s.sale_items || []).length} item</td>
      <td><strong style="color: var(--success);">${formatRupiah(s.total_amount)}</strong></td>
      <td style="color: var(--text-muted);">${s.profiles?.nama || '-'}</td>
    </tr>
  `).join('');

  // Update summary
  const totalRevenue = data.reduce((s, r) => s + Number(r.total_amount), 0);
  const totalItems = data.reduce((s, r) => s + (r.sale_items || []).reduce((si, i) => si + i.jumlah, 0), 0);
  document.getElementById('sales-summary').innerHTML = `
    <div class="stat-card">
      <div class="stat-icon green"><span class="material-icons-round">payments</span></div>
      <div class="stat-info">
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value">${formatRupiah(totalRevenue)}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue"><span class="material-icons-round">receipt_long</span></div>
      <div class="stat-info">
        <div class="stat-label">Jumlah Transaksi</div>
        <div class="stat-value">${data.length}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><span class="material-icons-round">fastfood</span></div>
      <div class="stat-info">
        <div class="stat-label">Total Item Terjual</div>
        <div class="stat-value">${totalItems}</div>
      </div>
    </div>
  `;
}

async function loadSales(filters = {}) {
  try {
    if (auth.isOutlet()) filters.outlet_id = auth.getOutletId();
    sales = await api.getSales(filters);
    renderSalesRows(sales);
  } catch (err) {
    notify.error('Gagal memuat penjualan: ' + err.message);
  }
}

export async function initSales() {
  products = await api.getProducts();
  
  if (!auth.isOutlet()) {
    outlets = await api.getOutlets();
    const outletSelect = document.getElementById('filter-outlet');
    if (outletSelect) {
      outlets.forEach(o => {
        outletSelect.innerHTML += `<option value="${o.id}">${o.nama}</option>`;
      });
    }
  }

  await loadSales({
    date_from: document.getElementById('filter-date-from')?.value,
    date_to: document.getElementById('filter-date-to')?.value,
  });

  // Filter
  document.getElementById('btn-filter-sales')?.addEventListener('click', () => {
    loadSales({
      outlet_id: document.getElementById('filter-outlet')?.value || '',
      date_from: document.getElementById('filter-date-from')?.value,
      date_to: document.getElementById('filter-date-to')?.value,
    });
  });

  // New sale
  document.getElementById('btn-new-sale')?.addEventListener('click', async () => {
    const isOutlet = auth.isOutlet();
    const outletId = isOutlet ? auth.getOutletId() : '';
    
    let stockMap = {};
    if (isOutlet && outletId) {
      try {
        const stockData = await api.getOutletStock(outletId);
        stockData.forEach(s => stockMap[s.product_id] = s.stok_tersedia);
      } catch (err) {
        console.warn('Gagal memuat stok outlet', err);
      }
    }

    const activeProducts = products.filter(p => p.is_active);
    const productsOptions = activeProducts.map(p => {
      const stock = isOutlet ? (stockMap[p.id] || 0) : '∞';
      return `<option value="${p.id}" data-harga="${p.harga_jual}" data-hpp="${p.hpp}" data-stok="${stock}">${p.nama} (Stok: ${stock}) - ${formatRupiah(p.harga_jual)}</option>`;
    }).join('');

    let outletSelectHtml = '';
    if (auth.isAdmin()) {
      outletSelectHtml = `
        <div class="form-group">
          <label class="form-label">Outlet *</label>
          <select class="form-select" id="f-sale-outlet">
            ${outlets.map(o => `<option value="${o.id}">${o.nama}</option>`).join('')}
          </select>
        </div>
      `;
    }

    const formHtml = `
      ${outletSelectHtml}
      <div class="form-group">
        <label class="form-label">Tanggal</label>
        <input type="date" class="form-input" id="f-sale-date" value="${toISODate(new Date())}">
      </div>
      <div id="sale-items">
        <div class="form-row sale-item" data-idx="0">
          <div class="form-group" style="flex:2;">
            <label class="form-label">Produk</label>
            <select class="form-select si-product" onchange="
              const opt = this.options[this.selectedIndex];
              const pt = this.closest('.sale-item');
              pt.querySelector('.si-harga').value = opt?.dataset?.harga || 0;
              const maxS = opt?.dataset?.stok;
              const inputJ = pt.querySelector('.si-jumlah');
              if (maxS && maxS !== '∞') inputJ.max = maxS;
            ">${productsOptions}</select>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Jumlah</label>
            <input type="number" class="form-input si-jumlah" value="1" min="1" ${isOutlet ? `max="${stockMap[activeProducts[0]?.id] || 0}"` : ''}>
          </div>
          <div class="form-group" style="flex:1;">
            <label class="form-label">Harga</label>
            <input type="number" class="form-input si-harga" value="${activeProducts[0]?.harga_jual || 0}">
          </div>
        </div>
      </div>
      <button type="button" class="btn btn-ghost btn-sm mt-4" id="add-sale-item">
        <span class="material-icons-round">add</span> Tambah Item
      </button>
      <div class="form-group mt-4">
        <label class="form-label">Catatan</label>
        <textarea class="form-textarea" id="f-sale-notes" placeholder="Catatan (opsional)"></textarea>
      </div>
    `;

    const result = await openModal('Catat Penjualan', formHtml, {
      confirmText: 'Simpan Penjualan',
      size: 'lg',
      onOpen: (modal) => {
        modal.querySelector('#add-sale-item')?.addEventListener('click', () => {
          const container = modal.querySelector('#sale-items');
          const div = document.createElement('div');
          div.className = 'form-row sale-item';
          div.innerHTML = `
            <div class="form-group" style="flex:2;">
              <select class="form-select si-product" onchange="
                const opt = this.options[this.selectedIndex];
                const pt = this.closest('.sale-item');
                pt.querySelector('.si-harga').value = opt?.dataset?.harga || 0;
                const maxS = opt?.dataset?.stok;
                const inputJ = pt.querySelector('.si-jumlah');
                if (maxS && maxS !== '∞') inputJ.max = maxS;
              ">${productsOptions}</select>
            </div>
            <div class="form-group" style="flex:1;">
              <input type="number" class="form-input si-jumlah" value="1" min="1" ${isOutlet ? `max="${stockMap[activeProducts[0]?.id] || 0}"` : ''}>
            </div>
            <div class="form-group" style="flex:1;">
              <input type="number" class="form-input si-harga" value="${activeProducts[0]?.harga_jual || 0}">
            </div>
            <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="this.parentElement.remove()">
              <span class="material-icons-round">delete</span>
            </button>
          `;
          container.appendChild(div);
        });
      },
      onConfirm: () => {
        const items = [];
        let valid = true;
        document.querySelectorAll('.sale-item').forEach(row => {
          const select = row.querySelector('.si-product');
          const product_id = select?.value;
          const hpp = select && select.options ? Number(select.options[select.selectedIndex]?.dataset?.hpp || 0) : 0;
          const stockStr = select && select.options ? select.options[select.selectedIndex]?.dataset?.stok : '∞';
          const maxStok = stockStr === '∞' ? Infinity : Number(stockStr);
          
          const jumlah = Number(row.querySelector('.si-jumlah')?.value || 0);
          const harga_jual = Number(row.querySelector('.si-harga')?.value || 0);
          
          if (jumlah > maxStok) {
            notify.error(`Sisa stok tidak mencukupi untuk jumlah yang dimasukkan! (Maks: ${maxStok})`);
            valid = false;
          }

          if (product_id && jumlah > 0) items.push({ product_id, jumlah, harga_jual, hpp });
        });
        
        if (!valid) return false;

        return {
          outlet_id: document.getElementById('f-sale-outlet')?.value || outletId,
          tanggal: document.getElementById('f-sale-date')?.value,
          notes: document.getElementById('f-sale-notes')?.value,
          items
        };
      }
    });

    if (result && result.items?.length > 0 && result.outlet_id) {
      try {
        await api.createSale(result.outlet_id, result.items, result.tanggal, result.notes);
        notify.success('Penjualan berhasil dicatat');
        await loadSales({
          date_from: document.getElementById('filter-date-from')?.value,
          date_to: document.getElementById('filter-date-to')?.value,
        });
      } catch (err) {
        notify.error('Gagal mencatat penjualan: ' + err.message);
      }
    }
  });
}
