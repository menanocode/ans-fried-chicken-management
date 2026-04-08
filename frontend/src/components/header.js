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
        <button class="header-btn" id="header-notifications" title="Notifikasi">
          <span class="material-icons-round">notifications</span>
          <span class="notification-dot" id="notification-dot" style="display:none;"></span>
        </button>
      </div>
    </header>
  `;
}

export function initHeaderEvents() {
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

  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('sidebar')?.classList.toggle('open');
    document.getElementById('sidebar-overlay')?.classList.toggle('visible');
  });
}
