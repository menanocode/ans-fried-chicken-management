import { auth } from '../services/auth.js';

const menuItems = [
  { section: 'MENU UTAMA', items: [
    { id: 'dashboard', icon: 'dashboard', label: 'Dashboard', roles: ['admin', 'outlet', 'management'] },
  ]},
  { section: 'MANAJEMEN', items: [
    { id: 'outlets', icon: 'store', label: 'Outlet', roles: ['admin'] },
    { id: 'products', icon: 'fastfood', label: 'Produk', roles: ['admin'] },
    { id: 'stock', icon: 'inventory_2', label: 'Monitoring Stok', roles: ['admin', 'outlet', 'management'] },
  ]},
  { section: 'TRANSAKSI', items: [
    { id: 'requests', icon: 'local_shipping', label: 'Permintaan Stok', roles: ['admin', 'outlet'] },
    { id: 'sales', icon: 'point_of_sale', label: 'Penjualan', roles: ['admin', 'outlet', 'management'] },
  ]},
  { section: 'KEUANGAN', items: [
    { id: 'hpp', icon: 'calculate', label: 'HPP & Harga', roles: ['admin', 'management'] },
  ]},
  { section: 'LAPORAN', items: [
    { id: 'reports', icon: 'analytics', label: 'Laporan', roles: ['admin', 'management'] },
  ]},
];

export function renderSidebar(activePage) {
  const role = auth.getRole();
  const userName = auth.getUserName();
  const initials = auth.getInitials();
  const outletName = auth.profile?.outlets?.nama || '';
  const roleLabel = role === 'admin' ? 'Admin Pusat' : role === 'outlet' ? outletName : 'Manajemen';

  let navHtml = '';
  for (const section of menuItems) {
    const visibleItems = section.items.filter(item => item.roles.includes(role));
    if (visibleItems.length === 0) continue;

    navHtml += `<div class="sidebar-section">
      <div class="sidebar-section-title">${section.section}</div>
      ${visibleItems.map(item => `
        <a class="sidebar-link ${activePage === item.id ? 'active' : ''}" data-page="${item.id}">
          <span class="material-icons-round">${item.icon}</span>
          <span>${item.label}</span>
        </a>
      `).join('')}
    </div>`;
  }

  return `
    <aside class="sidebar" id="sidebar">
      <div class="sidebar-brand">
        <div class="sidebar-brand-icon">🍗</div>
        <div class="sidebar-brand-text">
          <h1>ANS Chicken</h1>
          <span>Management System</span>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${navHtml}
      </nav>
      <div class="sidebar-footer">
        <div class="sidebar-user" id="sidebar-user">
          <div class="sidebar-user-avatar">${initials}</div>
          <div class="sidebar-user-info">
            <div class="name">${userName}</div>
            <div class="role">${roleLabel}</div>
          </div>
          <span class="material-icons-round" style="color: var(--text-muted); font-size: 18px;">logout</span>
        </div>
      </div>
    </aside>
    <div class="sidebar-overlay" id="sidebar-overlay"></div>
  `;
}

export function initSidebarEvents(navigateFn) {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', () => {
      const page = link.dataset.page;
      navigateFn(page);
      // Close mobile sidebar
      document.getElementById('sidebar')?.classList.remove('open');
      document.getElementById('sidebar-overlay')?.classList.remove('visible');
    });
  });

  document.getElementById('sidebar-user')?.addEventListener('click', () => {
    auth.logout();
  });

  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.remove('open');
    document.getElementById('sidebar-overlay')?.classList.remove('visible');
  });
}
