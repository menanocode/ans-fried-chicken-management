import { getTheme, toggleTheme } from '../services/theme.js';

export function renderHeader(title, subtitle) {
  return `
    <header class="header" id="main-header">
      <div class="header-left">
        <button class="menu-toggle" id="menu-toggle">
          <span class="material-icons-round">menu</span>
        </button>
        <div>
          <h2>${title}</h2>
          ${subtitle ? `<p>${subtitle}</p>` : ''}
        </div>
      </div>
      <div class="header-right">
        <button class="header-btn" id="theme-toggle" title="Ubah tema">
          <span class="material-icons-round" id="theme-toggle-icon">dark_mode</span>
        </button>
        <button class="header-btn" id="header-refresh" title="Refresh halaman">
          <span class="material-icons-round">refresh</span>
        </button>
        <button class="header-btn" id="header-notifications" title="Notifikasi">
          <span class="material-icons-round">notifications</span>
          <span class="notification-dot" id="notification-dot" style="display:none;"></span>
        </button>
      </div>
    </header>
  `;
}

export function initHeaderEvents({ onRefresh } = {}) {
  const syncThemeButton = () => {
    const iconEl = document.getElementById('theme-toggle-icon');
    const buttonEl = document.getElementById('theme-toggle');
    if (!iconEl || !buttonEl) return;

    const isLight = getTheme() === 'light';
    iconEl.textContent = isLight ? 'light_mode' : 'dark_mode';
    buttonEl.title = isLight ? 'Tema terang aktif, klik untuk tema gelap' : 'Tema gelap aktif, klik untuk tema terang';
  };

  syncThemeButton();

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    toggleTheme();
    syncThemeButton();
  });

  const refreshBtn = document.getElementById('header-refresh');
  refreshBtn?.addEventListener('click', async () => {
    if (refreshBtn.classList.contains('loading')) return;
    refreshBtn.classList.add('loading');
    try {
      if (typeof onRefresh === 'function') await onRefresh();
    } finally {
      window.setTimeout(() => refreshBtn.classList.remove('loading'), 200);
    }
  });

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (!sidebar || !overlay) return;

    const isOpen = sidebar.classList.toggle('open');
    overlay.classList.toggle('visible', isOpen);
    document.body.classList.toggle('sidebar-open-mobile', isOpen);
  });
}
