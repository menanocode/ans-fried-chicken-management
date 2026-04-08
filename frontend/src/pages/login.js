import { auth } from '../services/auth.js';
import { isConfigured } from '../config/supabase.js';
import * as notify from '../components/notification.js';

export function renderLogin() {
  const configWarning = !isConfigured ? `
    <div class="alert-box alert-warning mb-4" style="text-align:left;">
      <span class="material-icons-round">warning</span>
      <div>
        <strong>Supabase belum dikonfigurasi</strong><br>
        <span style="font-size: var(--font-xs);">Buat file <code>frontend/.env</code> dengan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY. Lihat README.md untuk panduan setup.</span>
      </div>
    </div>
  ` : '';

  return `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="login-logo-icon">🍗</div>
          <h1>ANS Chicken</h1>
          <p>Sistem Manajemen Penjualan</p>
        </div>
        ${configWarning}
        <form class="login-form" id="login-form">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-input" id="login-email" placeholder="email@example.com" required autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">Password</label>
            <input type="password" class="form-input" id="login-password" placeholder="••••••••" required autocomplete="current-password">
          </div>
          <button type="submit" class="btn btn-primary" id="login-btn">
            <span class="material-icons-round">login</span>
            Masuk
          </button>
        </form>
        <p style="text-align:center; margin-top: var(--sp-6); color: var(--text-muted); font-size: var(--font-xs);">
          © 2026 ANS Fried Chicken. All rights reserved.
        </p>
      </div>
    </div>
  `;
}

export function initLoginEvents(navigateFn) {
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    btn.classList.add('loading');
    btn.innerHTML = '<span class="spinner" style="width:20px;height:20px;border-width:2px;"></span> Masuk...';

    try {
      await auth.login(email, password);
      notify.success('Login berhasil!');
      navigateFn('dashboard');
    } catch (err) {
      notify.error('Login gagal: ' + (err.message || 'Email atau password salah'));
      btn.classList.remove('loading');
      btn.innerHTML = '<span class="material-icons-round">login</span> Masuk';
    }
  });
}
