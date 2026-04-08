import Chart from 'chart.js/auto';
import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { formatRupiah, getAppOpenISODate, exportCSV } from '../utils/helpers.js';

let salesByOutletChart = null;
let salesTrendChart = null;

export function renderReports() {
  return `
    <div class="page-header">
      <div>
        <h2>Laporan & Analitik</h2>
        <p>Analisis performa penjualan dan profitabilitas</p>
      </div>
      <button class="btn btn-secondary" id="btn-export-csv">
        <span class="material-icons-round">download</span> Export CSV
      </button>
    </div>

    <div class="tabs" id="report-tabs">
      <button class="tab active" data-tab="sales">📊 Penjualan</button>
      <button class="tab" data-tab="profit">💰 Profit</button>
    </div>

    <div id="tab-sales">
      <div class="filter-bar">
        <input type="date" class="form-input" id="rpt-date-from" value="${getAppOpenISODate()}">
        <input type="date" class="form-input" id="rpt-date-to" value="${getAppOpenISODate()}">
        <button class="btn btn-primary btn-sm" id="btn-load-report">
          <span class="material-icons-round">refresh</span> Load
        </button>
      </div>

      <div class="grid-2 mb-6">
        <div class="card">
          <div class="card-header"><h3>Penjualan per Outlet</h3></div>
          <div class="chart-container"><canvas id="chart-by-outlet"></canvas></div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Trend Penjualan Harian</h3></div>
          <div class="chart-container"><canvas id="chart-trend"></canvas></div>
        </div>
      </div>

      <div class="stats-grid stagger" id="report-summary" style="margin-bottom: var(--sp-6);"></div>

      <div class="card">
        <div class="card-header"><h3>Performa Keseluruhan per Outlet</h3></div>
        <div class="table-wrapper" style="border:none;">
          <table>
            <thead>
              <tr><th>Outlet</th><th>Jumlah Transaksi</th><th>Omset (Revenue)</th><th>Laba Bersih (Profit)</th></tr>
            </thead>
            <tbody id="report-outlet-tbody">
              <tr><td colspan="4"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <div id="tab-profit" style="display:none;">
      <div class="card">
        <div class="card-header"><h3>Analisis Profit per Produk</h3></div>
        <div class="table-wrapper" style="border:none;">
          <table>
            <thead>
              <tr><th>Produk</th><th>Kategori</th><th>HPP</th><th>Harga Jual</th><th>Profit/Item</th><th>Margin</th></tr>
            </thead>
            <tbody id="profit-tbody">
              <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

const CHART_COLORS = [
  '#f97316','#3b82f6','#22c55e','#f59e0b','#ef4444','#8b5cf6','#ec4899','#14b8a6',
  '#f43f5e','#6366f1','#84cc16','#06b6d4','#a855f7','#eab308','#10b981','#e11d48',
  '#0ea5e9','#d946ef','#facc15','#2dd4bf','#fb923c'
];

async function loadSalesReport() {
  try {
    const filters = {
      date_from: document.getElementById('rpt-date-from')?.value,
      date_to: document.getElementById('rpt-date-to')?.value,
    };

    const [byOutlet, salesData] = await Promise.all([
      api.getSalesByOutlet(filters),
      api.getSalesReport(filters),
    ]);

    // Chart: by outlet (horizontal bar)
    if (salesByOutletChart) salesByOutletChart.destroy();
    const ctxOutlet = document.getElementById('chart-by-outlet');
    if (ctxOutlet) {
      salesByOutletChart = new Chart(ctxOutlet, {
        type: 'bar',
        data: {
          labels: byOutlet.slice(0, 15).map(o => o.outlet),
          datasets: [{
            label: 'Revenue (Rp)',
            data: byOutlet.slice(0, 15).map(o => o.total),
            backgroundColor: CHART_COLORS.slice(0, 15),
            borderRadius: 6,
            borderSkipped: false,
          }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => formatRupiah(ctx.raw)
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9898a8', callback: v => formatRupiah(v) }
            },
            y: {
              grid: { display: false },
              ticks: { color: '#f0f0f5', font: { size: 11 } }
            }
          }
        }
      });
    }

    // Chart: daily trend
    const dailyMap = {};
    salesData.forEach(s => {
      if (!dailyMap[s.tanggal]) dailyMap[s.tanggal] = 0;
      dailyMap[s.tanggal] += Number(s.total_amount);
    });
    const dates = Object.keys(dailyMap).sort();

    if (salesTrendChart) salesTrendChart.destroy();
    const ctxTrend = document.getElementById('chart-trend');
    if (ctxTrend) {
      salesTrendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
          labels: dates,
          datasets: [{
            label: 'Revenue Harian',
            data: dates.map(d => dailyMap[d]),
            borderColor: '#f97316',
            backgroundColor: 'rgba(249,115,22,0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 3,
            pointBackgroundColor: '#f97316',
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => formatRupiah(ctx.raw)
              }
            }
          },
          scales: {
            x: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9898a8', maxTicksLimit: 10, font: { size: 10 } }
            },
            y: {
              grid: { color: 'rgba(255,255,255,0.05)' },
              ticks: { color: '#9898a8', callback: v => formatRupiah(v) }
            }
          }
        }
      });
    }

    // Table and Summary
    let sumOmset = 0;
    let sumLaba = 0;
    let sumTransactions = 0;

    const tbody = document.getElementById('report-outlet-tbody');
    tbody.innerHTML = byOutlet.map(o => {
      sumOmset += o.total;
      sumLaba += o.profit;
      sumTransactions += o.count;
      
      return `
      <tr>
        <td><strong>${o.outlet}</strong></td>
        <td>${o.count}</td>
        <td style="color: var(--success); font-weight: 600;">${formatRupiah(o.total)}</td>
        <td style="color: ${o.profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">${formatRupiah(o.profit)}</td>
      </tr>
      `;
    }).join('') || '<tr><td colspan="4" class="text-center text-muted">Tidak ada data</td></tr>';

    const summaryEl = document.getElementById('report-summary');
    if (summaryEl) {
      summaryEl.innerHTML = `
        <div class="stat-card">
          <div class="stat-icon green"><span class="material-icons-round">account_balance_wallet</span></div>
          <div class="stat-info">
            <div class="stat-label">Total Omset (Kotor)</div>
            <div class="stat-value">${formatRupiah(sumOmset)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon ${sumLaba >= 0 ? 'blue' : 'red'}"><span class="material-icons-round">savings</span></div>
          <div class="stat-info">
            <div class="stat-label">Total Laba Bersih</div>
            <div class="stat-value">${formatRupiah(sumLaba)}</div>
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-icon orange"><span class="material-icons-round">receipt_long</span></div>
          <div class="stat-info">
            <div class="stat-label">Total Transaksi</div>
            <div class="stat-value">${sumTransactions}</div>
          </div>
        </div>
      `;
    }

    // Store for CSV export
    window.__reportData = byOutlet;
  } catch (err) {
    notify.error('Gagal memuat laporan: ' + err.message);
  }
}

async function loadProfitReport() {
  try {
    const data = await api.getProfitReport();
    const tbody = document.getElementById('profit-tbody');
    tbody.innerHTML = data.map(p => {
      const profit = Number(p.harga_jual) - Number(p.hpp);
      return `
        <tr>
          <td><strong>${p.nama}</strong></td>
          <td><span class="badge badge-orange">${p.categories?.nama || '-'}</span></td>
          <td>${formatRupiah(p.hpp)}</td>
          <td>${formatRupiah(p.harga_jual)}</td>
          <td style="color: ${profit >= 0 ? 'var(--success)' : 'var(--danger)'}; font-weight: 700;">${formatRupiah(profit)}</td>
          <td><span class="badge ${Number(p.margin_persen) >= 50 ? 'badge-success' : 'badge-warning'}">${p.margin_persen}%</span></td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    notify.error('Gagal memuat data profit: ' + err.message);
  }
}

export async function initReports() {
  await Promise.all([loadSalesReport(), loadProfitReport()]);

  // Tab switching
  document.querySelectorAll('#report-tabs .tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('#report-tabs .tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const tabName = tab.dataset.tab;
      document.getElementById('tab-sales').style.display = tabName === 'sales' ? '' : 'none';
      document.getElementById('tab-profit').style.display = tabName === 'profit' ? '' : 'none';
    });
  });

  document.getElementById('btn-load-report')?.addEventListener('click', loadSalesReport);

  document.getElementById('btn-export-csv')?.addEventListener('click', () => {
    const data = window.__reportData;
    if (data?.length) {
      exportCSV(data, 'laporan_penjualan_outlet');
      notify.success('CSV berhasil di-download');
    } else {
      notify.warning('Tidak ada data untuk di-export');
    }
  });
}
