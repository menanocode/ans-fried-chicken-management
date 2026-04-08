const container = document.getElementById('notification-container');

const ICONS = {
  success: 'check_circle',
  error: 'error',
  warning: 'warning',
  info: 'info'
};

export function showNotification(message, type = 'info', duration = 4000) {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="material-icons-round toast-icon">${ICONS[type]}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close material-icons-round" onclick="this.parentElement.remove()">close</button>
  `;
  container.appendChild(toast);

  if (duration > 0) {
    setTimeout(() => {
      toast.style.animation = 'fadeIn 200ms ease reverse';
      setTimeout(() => toast.remove(), 200);
    }, duration);
  }

  return toast;
}

export function success(msg) { return showNotification(msg, 'success'); }
export function error(msg) { return showNotification(msg, 'error', 6000); }
export function warning(msg) { return showNotification(msg, 'warning', 5000); }
export function info(msg) { return showNotification(msg, 'info'); }
