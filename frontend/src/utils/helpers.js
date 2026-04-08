// Format currency to Indonesian Rupiah
export function formatRupiah(num) {
  if (num == null) return 'Rp 0';
  return 'Rp ' + Number(num).toLocaleString('id-ID');
}

// Format date to Indonesian locale
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric'
  });
}

// Format datetime
export function formatDateTime(dateStr) {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('id-ID', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

// Short date YYYY-MM-DD
export function toISODate(date) {
  return date ? new Date(date).toISOString().split('T')[0] : '';
}

// Status badge HTML
export function statusBadge(status) {
  const map = {
    pending: { class: 'badge-warning', icon: 'schedule', label: 'Pending' },
    approved: { class: 'badge-success', icon: 'check_circle', label: 'Disetujui' },
    rejected: { class: 'badge-danger', icon: 'cancel', label: 'Ditolak' },
    active: { class: 'badge-success', icon: 'check_circle', label: 'Aktif' },
    inactive: { class: 'badge-danger', icon: 'cancel', label: 'Nonaktif' },
  };
  const s = map[status] || { class: 'badge-secondary', icon: 'info', label: status };
  return `<span class="badge ${s.class}"><span class="material-icons-round">${s.icon}</span>${s.label}</span>`;
}

// Stock level class
export function stockLevel(current, minimum) {
  const ratio = current / minimum;
  if (ratio <= 1) return 'stock-critical';
  if (ratio <= 1.5) return 'stock-warning';
  return 'stock-good';
}

// Stock level percentage (capped at 100%)
export function stockPercent(current, minimum) {
  const target = minimum * 3; // full bar = 3x minimum
  return Math.min(100, Math.round((current / target) * 100));
}

// Debounce
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Generate a simple CSV from array of objects
export function exportCSV(data, filename) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => `"${row[h] ?? ''}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// Escape HTML to prevent XSS
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
