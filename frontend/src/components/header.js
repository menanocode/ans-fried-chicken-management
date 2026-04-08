import { getTheme, toggleTheme } from '../services/theme.js';
import { openModal } from './modal.js';
import {
  getActivityLogs,
  getUnreadActivityCount,
  markActivityLogsSeen,
} from '../services/activity-log.js';
import { escapeHtml, formatDateTime } from '../utils/helpers.js';

let notificationPollTimer = null;
let activityUpdatedHandler = null;

function actionLabel(action) {
  const map = {
    create: 'Ditambahkan',
    update: 'Diperbarui',
    delete: 'Dihapus',
    approve: 'Disetujui',
    reject: 'Ditolak',
    checkout: 'Checkout',
    system: 'Sistem',
  };
  return map[action] || 'Perubahan';
}

function actorLabel(role) {
  if (!role) return 'Pengguna';
  if (role === 'admin') return 'Admin';
  if (role === 'outlet') return 'Outlet';
  if (role === 'management') return 'Manajemen';
  return role;
}

function renderLogItems(logs) {
  if (!logs.length) {
    return `
      <div class="activity-log-empty">
        <span class="material-icons-round">notifications_none</span>
        <h4>Belum ada notifikasi</h4>
        <p>Aktivitas perubahan data akan muncul di sini.</p>
      </div>
    `;
  }

  return `
    <div class="activity-log-list">
      ${logs.map(log => `
        <article class="activity-log-item">
          <div class="activity-log-item-head">
            <h4>${escapeHtml(log.title || 'Aktivitas baru')}</h4>
            <span>${formatDateTime(log.created_at)}</span>
          </div>
          ${log.description ? `<p>${escapeHtml(log.description)}</p>` : ''}
          <div class="activity-log-item-meta">
            <span class="badge badge-secondary">${actionLabel(log.action)}</span>
            <span>${actorLabel(log.actor_role)}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

async function syncNotificationDot() {
  const dot = document.getElementById('notification-dot');
  if (!dot) return;
  try {
    const unreadCount = await getUnreadActivityCount({ limit: 80 });
    dot.style.display = unreadCount > 0 ? 'block' : 'none';
  } catch {
    dot.style.display = 'none';
  }
}

function bindNotificationRealtime() {
  if (activityUpdatedHandler) {
    window.removeEventListener('activity-log-updated', activityUpdatedHandler);
  }
  activityUpdatedHandler = () => {
    void syncNotificationDot();
  };
  window.addEventListener('activity-log-updated', activityUpdatedHandler);

  if (notificationPollTimer) window.clearInterval(notificationPollTimer);
  notificationPollTimer = window.setInterval(() => {
    if (!document.getElementById('header-notifications')) {
      window.clearInterval(notificationPollTimer);
      notificationPollTimer = null;
      return;
    }
    void syncNotificationDot();
  }, 30000);
}

async function openNotificationsModal() {
  await openModal(
    'Log Notifikasi',
    `
      <div class="activity-log-body" id="activity-log-body">
        <div class="loading-spinner"><div class="spinner"></div></div>
      </div>
    `,
    {
      footer: false,
      size: 'lg',
      onOpen: async (modal) => {
        markActivityLogsSeen();
        await syncNotificationDot();
        const body = modal.querySelector('#activity-log-body');
        if (!body) return;
        try {
          const logs = await getActivityLogs({ limit: 80 });
          body.innerHTML = renderLogItems(logs);
        } catch (error) {
          body.innerHTML = `
            <div class="activity-log-empty">
              <span class="material-icons-round">error</span>
              <h4>Gagal memuat notifikasi</h4>
              <p>${escapeHtml(error.message || 'Terjadi kesalahan tidak terduga.')}</p>
            </div>
          `;
        }
      },
    }
  );
}

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

  bindNotificationRealtime();
  void syncNotificationDot();

  document.getElementById('header-notifications')?.addEventListener('click', async () => {
    await openNotificationsModal();
  });
}
