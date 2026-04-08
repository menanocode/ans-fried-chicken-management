import './styles/main.css';
import { auth } from './services/auth.js';
import { clearApiCache } from './services/api.js';
import { renderSidebar, initBottomNavEvents, initSidebarEvents, renderBottomNav } from './components/sidebar.js';
import { renderHeader, initHeaderEvents } from './components/header.js';
import { renderLogin, initLoginEvents } from './pages/login.js';
import { renderDashboard, initDashboard } from './pages/dashboard.js';
import { renderOutlets, initOutlets } from './pages/outlets.js';
import { renderProducts, initProducts } from './pages/products.js';
import { renderStock, initStock } from './pages/stock.js';
import { renderRequests, initRequests } from './pages/requests.js';
import { renderSales, initSales } from './pages/sales.js';
import { renderHpp, initHpp } from './pages/hpp.js';
import { renderReports, initReports } from './pages/reports.js';
import { initTheme } from './services/theme.js';

const app = document.getElementById('app');
initTheme();

const PAGE_TITLES = {
  dashboard: ['Dashboard', 'Overview sistem manajemen'],
  outlets: ['Manajemen Outlet', 'Kelola data outlet'],
  products: ['Manajemen Produk', 'Kelola produk ayam & minuman'],
  stock: ['Stok Gudang', 'Pantau persediaan gudang pusat'],
  requests: ['Permintaan Stok', 'Kelola permintaan stok outlet'],
  sales: ['Penjualan', 'Data penjualan outlet'],
  hpp: ['HPP & Harga Jual', 'Kalkulasi harga pokok produksi'],
  reports: ['Laporan', 'Analitik dan laporan penjualan'],
};

const PAGE_RENDERERS = {
  dashboard: renderDashboard,
  outlets: renderOutlets,
  products: renderProducts,
  stock: renderStock,
  requests: renderRequests,
  sales: renderSales,
  hpp: renderHpp,
  reports: renderReports,
};

const PAGE_INIT = {
  dashboard: initDashboard,
  outlets: initOutlets,
  products: initProducts,
  stock: initStock,
  requests: initRequests,
  sales: initSales,
  hpp: initHpp,
  reports: initReports,
};

let currentPage = 'dashboard';

function navigate(page) {
  currentPage = page;
  window.location.hash = page;
  renderApp();
}

function renderApp() {
  if (!auth.user || !auth.profile) {
    document.body.classList.remove('has-mobile-bottom-nav');
    document.body.classList.remove('sidebar-open-mobile');
    app.innerHTML = renderLogin();
    initLoginEvents(navigate);
    document.title = 'ANS Chicken - Login';
    return;
  }

  const page = currentPage;
  const [title, subtitle] = PAGE_TITLES[page] || ['ANS Chicken', ''];
  const renderPage = PAGE_RENDERERS[page];
  const hasMobileBottomNav = auth.isOutlet();

  if (!renderPage) {
    navigate('dashboard');
    return;
  }

  document.body.classList.toggle('has-mobile-bottom-nav', hasMobileBottomNav);

  app.innerHTML = `
    ${renderSidebar(page)}
    <div class="main-wrapper">
      ${renderHeader(title, subtitle)}
      <main class="main-content fade-in">
        ${renderPage()}
      </main>
      ${renderBottomNav(page)}
    </div>
  `;

  document.title = `${title} - ANS Chicken`;

  // Init events
  initSidebarEvents(navigate);
  initBottomNavEvents(navigate);
  initHeaderEvents({
    onRefresh: async () => {
      clearApiCache();
      renderApp();
    },
  });

  // Init page-specific logic
  const initPage = PAGE_INIT[page];
  if (initPage) initPage();
}

// Listen for hash changes
window.addEventListener('hashchange', () => {
  const hash = window.location.hash.slice(1) || 'dashboard';
  if (hash !== currentPage) {
    currentPage = hash;
    renderApp();
  }
});

// Listen for auth state changes
auth.onChange(() => renderApp());

// Boot
async function boot() {
  app.innerHTML = `
    <div style="display:flex; align-items:center; justify-content:center; min-height:100vh; flex-direction:column; gap: 16px;">
      <div class="sidebar-brand-icon" style="width:56px;height:56px;font-size:1.8rem;">🍗</div>
      <div class="spinner"></div>
      <p style="color: var(--text-muted); font-size: var(--font-sm);">Memuat ANS Chicken...</p>
    </div>
  `;

  try {
    await auth.init();
  } catch (err) {
    console.warn('Auth init failed (Supabase not configured?):', err.message);
  }

  // Read initial hash
  currentPage = window.location.hash.slice(1) || 'dashboard';
  renderApp();
}

boot();
