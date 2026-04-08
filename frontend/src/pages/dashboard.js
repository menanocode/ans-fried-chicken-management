import { auth } from '../services/auth.js';
import { getDashboardStats } from '../services/api.js';
import { formatRupiah } from '../utils/helpers.js';

export function renderDashboard() {
  return `
    <div class="page-header">
      <div>
        <h2>ANS Chicken</h2>
        <p>Selamat datang kembali, ${auth.getUserName()} 👋</p>
      </div>
    </div>
    <div class="stats-grid stagger" id="stats-grid">
      ${!auth.isOutlet() ? `
      <div class="stat-card">
        <div class="stat-icon blue"><span class="material-icons-round">store</span></div>
        <div class="stat-info">
          <div class="stat-label">Outlet Aktif</div>
          <div class="stat-value" id="stat-outlets">-</div>
          <div class="stat-change">unit operasional</div>
        </div>
      </div>
      ` : ''}
      <div class="stat-card">
        <div class="stat-icon orange"><span class="material-icons-round">local_shipping</span></div>
        <div class="stat-info">
          <div class="stat-label">Izin Stok</div>
          <div class="stat-value" id="stat-pending">-</div>
          <div class="stat-change">perlu persetujuan</div>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon green"><span class="material-icons-round">payments</span></div>
        <div class="stat-info">
          <div class="stat-label">Omset Hari Ini</div>
          <div class="stat-value" id="stat-revenue">-</div>
          <div class="stat-change" id="stat-sales-count">0 transaksi</div>
        </div>
      </div>
      ${!auth.isOutlet() ? `
      <div class="stat-card">
        <div class="stat-icon indigo" style="background:var(--primary-light);">
          <span class="material-icons-round" style="color:var(--primary);">savings</span>
        </div>
        <div class="stat-info">
          <div class="stat-label">Laba Bersih</div>
          <div class="stat-value" id="stat-profit">-</div>
          <div class="stat-change">estimasi real-time</div>
        </div>
      </div>
      ` : ''}
      <div class="stat-card">
        <div class="stat-icon red"><span class="material-icons-round">inventory_2</span></div>
        <div class="stat-info">
          <div class="stat-label">Stok Kritis</div>
          <div class="stat-value" id="stat-lowstock">-</div>
          <div class="stat-change">produk menipis</div>
        </div>
      </div>
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header">
          <h3>⚠️ Peringatan Stok Menipis</h3>
        </div>
        <div id="low-stock-list">
          <div class="loading-spinner"><div class="spinner"></div></div>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <h3>⚡ Akses Cepat</h3>
        </div>
        <div style="padding: var(--sp-4); display: grid; grid-template-columns: 1fr 1fr; gap: var(--sp-3);">
          <button class="btn btn-primary" onclick="window.location.hash = 'sales'" style="justify-content:center; padding: var(--sp-4);">
            <span class="material-icons-round">point_of_sale</span> Catat Jual
          </button>
          <button class="btn btn-secondary" onclick="window.location.hash = 'requests'" style="justify-content:center; padding: var(--sp-4);">
            <span class="material-icons-round">local_shipping</span> Minta Stok
          </button>
          <button class="btn btn-ghost" onclick="window.location.hash = 'reports'" style="border: 1px solid var(--border-color); justify-content:center;">
             <span class="material-icons-round">analytics</span> Laporan
          </button>
          <button class="btn btn-ghost" onclick="window.location.hash = 'stock'" style="border: 1px solid var(--border-color); justify-content:center;">
             <span class="material-icons-round">inventory</span> Cek Stok
          </button>
        </div>
      </div>
    </div>
  `;
}

export async function initDashboard() {
  try {
    const stats = await getDashboardStats();

    const statOutlets = document.getElementById('stat-outlets');
    if (statOutlets) statOutlets.textContent = stats.totalOutlets;
    document.getElementById('stat-pending').textContent = stats.pendingRequests;
    document.getElementById('stat-revenue').textContent = formatRupiah(stats.todayRevenue);
    const statProfit = document.getElementById('stat-profit');
    if (statProfit) statProfit.textContent = formatRupiah(stats.todayProfit);
    document.getElementById('stat-sales-count').textContent = `${stats.todaySalesCount} transaksi`;
    document.getElementById('stat-lowstock').textContent = stats.lowStockCount;

    // Render low stock alerts
    const lowStockList = document.getElementById('low-stock-list');
    if (stats.lowStockItems.length === 0) {
      lowStockList.innerHTML = `
        <div class="empty-state" style="padding: var(--sp-6);">
          <span class="material-icons-round" style="font-size:40px;">check_circle</span>
          <h3 style="color: var(--success); font-size: var(--font-base);">Semua Stok Aman</h3>
          <p>Tidak ada produk yang stoknya di bawah minimum</p>
        </div>`;
    } else {
      lowStockList.innerHTML = stats.lowStockItems.map(item => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-color);">
          <div>
            <div style="font-weight:600; font-size: var(--font-sm);">${item.products?.nama || 'Unknown'}</div>
            <div style="font-size: var(--font-xs); color: var(--text-muted);">Min: ${item.stok_minimum}</div>
          </div>
          <span class="badge badge-danger">${item.stok_tersedia} tersisa</span>
        </div>
      `).join('');
    }

    // Quick summary
    const quickSummary = document.getElementById('quick-summary');
    if (quickSummary) {
      quickSummary.innerHTML = `
        <div style="display:flex; flex-direction:column; gap: var(--sp-4);">
          <div style="display:flex; align-items:center; justify-content:space-between; padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-secondary); font-size: var(--font-sm);">Outlet Aktif</span>
            <span style="font-weight:700; font-size: var(--font-md);">${stats.totalOutlets}</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-secondary); font-size: var(--font-sm);">Permintaan Pending</span>
            <span class="badge badge-warning">${stats.pendingRequests}</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding: var(--sp-3) 0; border-bottom: 1px solid var(--border-color);">
            <span style="color: var(--text-secondary); font-size: var(--font-sm);">Revenue Hari Ini</span>
            <span style="font-weight:700; color: var(--success);">${formatRupiah(stats.todayRevenue)}</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding: var(--sp-3) 0;">
            <span style="color: var(--text-secondary); font-size: var(--font-sm);">Produk Stok Kritis</span>
            <span class="badge ${stats.lowStockCount > 0 ? 'badge-danger' : 'badge-success'}">${stats.lowStockCount}</span>
          </div>
        </div>
      `;
    }

    // Show notification dot if there are alerts
    if (stats.pendingRequests > 0 || stats.lowStockCount > 0) {
      const dot = document.getElementById('notification-dot');
      if (dot) dot.style.display = 'block';
    }
  } catch (err) {
    console.error('Dashboard error:', err);
  }
}
