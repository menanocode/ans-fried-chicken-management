import { auth } from '../services/auth.js';
import * as api from '../services/api.js';
import * as notify from '../components/notification.js';
import { openModal } from '../components/modal.js';
import { formatRupiah, formatDate, toISODate, escapeHtml } from '../utils/helpers.js';

let sales = [];
let products = [];
let outlets = [];

const posState = {
  category: 'all',
  search: '',
  cart: [],
  payment: 'tunai',
  date: toISODate(new Date()),
  notes: '',
  stockMap: {},
  dayTransactionCount: 0,
  processingCheckout: false,
};

function getProductCategoryName(product) {
  return product?.categories?.nama || 'Tanpa kategori';
}

function getOutletActiveProducts() {
  return products.filter(p => p.is_active);
}

function getOutletStock(productId) {
  return Number(posState.stockMap[productId] || 0);
}

function getOutletCategories() {
  const unique = new Map();
  getOutletActiveProducts().forEach(product => {
    const label = getProductCategoryName(product);
    const key = label.toLowerCase();
    if (!unique.has(key)) unique.set(key, label);
  });

  return [
    { key: 'all', label: 'Semua' },
    ...Array.from(unique.entries())
      .sort((a, b) => a[1].localeCompare(b[1], 'id-ID'))
      .map(([key, label]) => ({ key, label })),
  ];
}

function getFilteredOutletProducts() {
  const keyword = posState.search.trim().toLowerCase();
  return getOutletActiveProducts().filter(product => {
    const categoryName = getProductCategoryName(product);
    if (posState.category !== 'all' && categoryName.toLowerCase() !== posState.category) return false;
    if (!keyword) return true;
    return (
      product.nama.toLowerCase().includes(keyword) ||
      categoryName.toLowerCase().includes(keyword)
    );
  });
}

function getCartItemCount() {
  return posState.cart.length;
}

function getCartTotalPcs() {
  return posState.cart.reduce((sum, item) => sum + item.qty, 0);
}

function getCartTotalAmount() {
  return posState.cart.reduce((sum, item) => sum + (item.qty * item.harga_jual), 0);
}

function getStockBadgeClass(stock) {
  if (stock <= 0) return 'danger';
  if (stock <= 5) return 'warning';
  return 'safe';
}

function renderBackofficeSales() {
  const isOutlet = auth.isOutlet();
  const canCreate = auth.isAdmin();

  return `
    <div class="page-header">
      <div>
        <h2>Penjualan</h2>
        <p>${isOutlet ? 'Catat penjualan harian outlet Anda' : 'Data penjualan semua outlet'}</p>
      </div>
      ${canCreate ? `
        <button class="btn btn-primary" id="btn-new-sale">
          <span class="material-icons-round">add</span> Catat Penjualan
        </button>
      ` : ''}
    </div>
    <div class="filter-bar">
      <select class="form-select" id="filter-outlet">
        <option value="">Semua Outlet</option>
      </select>
      <input type="date" class="form-input" id="filter-date-from" value="${toISODate(new Date(Date.now() - 30 * 86400000))}">
      <input type="date" class="form-input" id="filter-date-to" value="${toISODate(new Date())}">
      <button class="btn btn-secondary" id="btn-filter-sales">
        <span class="material-icons-round">filter_list</span> Filter
      </button>
    </div>
    <div class="stats-grid stagger" id="sales-summary"></div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Kode</th>
            <th>Outlet</th>
            <th>Tanggal</th>
            <th>Items</th>
            <th>Total</th>
            <th>Dicatat oleh</th>
          </tr>
        </thead>
        <tbody id="sales-tbody">
          <tr><td colspan="6"><div class="loading-spinner"><div class="spinner"></div></div></td></tr>
        </tbody>
      </table>
    </div>
  `;
}

function renderOutletSalesPOS() {
  return `
    <div class="sales-pos-page" id="sales-pos-root">
      <div class="page-header sales-pos-header">
        <div>
          <h2>Kasir Penjualan</h2>
          <p>Fokus ke penjualan produk, pilih item lalu lanjut checkout ke keranjang aktif.</p>
        </div>
        <div class="sales-pos-counter-card">
          <span>Transaksi tersimpan</span>
          <strong id="sales-pos-day-count">0</strong>
        </div>
      </div>

      <div class="sales-pos-layout">
        <section class="sales-pos-products-panel">
          <div class="sales-pos-panel-head">
            <div>
              <h3>Produk siap jual</h3>
              <p>Pilih produk yang tersedia untuk menambah ke keranjang.</p>
            </div>
            <label class="sales-pos-search">
              <span class="material-icons-round">search</span>
              <input
                type="text"
                id="sales-pos-search"
                placeholder="Cari produk atau kategori"
                autocomplete="off"
              >
            </label>
          </div>

          <div class="sales-pos-categories" id="sales-pos-category-filters"></div>
          <div class="sales-pos-products-grid" id="sales-pos-products-grid"></div>
        </section>

        <aside class="sales-pos-cart-panel">
          <div class="sales-pos-cart-head">
            <div>
              <h3>Keranjang aktif</h3>
              <p>Semua item yang dipilih akan muncul di sini.</p>
            </div>
            <span class="sales-pos-item-pill" id="sales-pos-cart-count-pill">0 item</span>
          </div>

          <div class="sales-pos-cart-items" id="sales-pos-cart-items"></div>

          <div class="sales-pos-controls">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Tanggal transaksi</label>
                <input type="date" class="form-input" id="sales-pos-date" value="${posState.date}">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Catatan</label>
              <textarea class="form-textarea" id="sales-pos-notes" placeholder="Catatan transaksi (opsional)"></textarea>
            </div>

            <div class="sales-pos-payment">
              <div class="sales-pos-payment-title">Metode pembayaran</div>
              <div class="sales-pos-payment-options">
                <button type="button" class="sales-pos-pay-btn active" data-payment="tunai">
                  <span class="material-icons-round">payments</span> Tunai
                </button>
                <button type="button" class="sales-pos-pay-btn" data-payment="qris">
                  <span class="material-icons-round">qr_code_2</span> QRIS
                </button>
                <button type="button" class="sales-pos-pay-btn" data-payment="transfer">
                  <span class="material-icons-round">account_balance</span> Transfer
                </button>
              </div>
            </div>
          </div>

          <div class="sales-pos-total-card">
            <div class="sales-pos-total-meta">
              <span>Total tagihan</span>
              <span id="sales-pos-total-pcs">0 pcs</span>
            </div>
            <div class="sales-pos-total-amount" id="sales-pos-total-amount">${formatRupiah(0)}</div>
            <button type="button" id="sales-pos-checkout" class="sales-pos-checkout-btn">
              Selesaikan transaksi
            </button>
            <p>Checkout akan mengurangi stok outlet dan menyimpan transaksi ke laporan.</p>
          </div>
        </aside>
      </div>
    </div>
  `;
}

export function renderSales() {
  if (auth.isOutlet()) return renderOutletSalesPOS();
  return renderBackofficeSales();
}

function renderSalesRows(data) {
  const tbody = document.getElementById('sales-tbody');
  if (!tbody) return;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="6"><div class="table-empty"><span class="material-icons-round">point_of_sale</span><p>Belum ada data penjualan</p></div></td></tr>';
    return;
  }

  tbody.innerHTML = data.map(s => `
    <tr>
      <td><strong style="color: var(--orange-400);">${s.sale_code || '-'}</strong></td>
      <td>${s.outlets?.nama || '-'}</td>
      <td>${formatDate(s.tanggal)}</td>
      <td>${(s.sale_items || []).length} item</td>
      <td><strong style="color: var(--success);">${formatRupiah(s.total_amount)}</strong></td>
      <td style="color: var(--text-muted);">${s.profiles?.nama || '-'}</td>
    </tr>
  `).join('');

  const totalRevenue = data.reduce((sum, row) => sum + Number(row.total_amount), 0);
  const totalItems = data.reduce((sum, row) => sum + (row.sale_items || []).reduce((itemSum, item) => itemSum + item.jumlah, 0), 0);

  const summary = document.getElementById('sales-summary');
  if (!summary) return;

  summary.innerHTML = `
    <div class="stat-card">
      <div class="stat-icon green"><span class="material-icons-round">payments</span></div>
      <div class="stat-info">
        <div class="stat-label">Total Revenue</div>
        <div class="stat-value">${formatRupiah(totalRevenue)}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon blue"><span class="material-icons-round">receipt_long</span></div>
      <div class="stat-info">
        <div class="stat-label">Jumlah Transaksi</div>
        <div class="stat-value">${data.length}</div>
      </div>
    </div>
    <div class="stat-card">
      <div class="stat-icon orange"><span class="material-icons-round">fastfood</span></div>
      <div class="stat-info">
        <div class="stat-label">Total Item Terjual</div>
        <div class="stat-value">${totalItems}</div>
      </div>
    </div>
  `;
}

async function loadBackofficeSales(filters = {}) {
  try {
    sales = await api.getSales(filters);
    renderSalesRows(sales);
  } catch (err) {
    notify.error('Gagal memuat penjualan: ' + err.message);
  }
}

function renderOutletCategoryFilters() {
  const container = document.getElementById('sales-pos-category-filters');
  if (!container) return;

  const categories = getOutletCategories();
  container.innerHTML = categories.map(category => `
    <button
      type="button"
      class="sales-pos-chip ${posState.category === category.key ? 'active' : ''}"
      data-category="${category.key}"
    >
      ${escapeHtml(category.label)}
    </button>
  `).join('');
}

function renderOutletProductsGrid() {
  const grid = document.getElementById('sales-pos-products-grid');
  if (!grid) return;

  const filteredProducts = getFilteredOutletProducts();
  if (!filteredProducts.length) {
    grid.innerHTML = `
      <div class="sales-pos-empty">
        <span class="material-icons-round">search_off</span>
        <h4>Produk tidak ditemukan</h4>
        <p>Ubah kata kunci pencarian atau pilih kategori lain.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredProducts.map(product => {
    const stock = getOutletStock(product.id);
    const stockClass = getStockBadgeClass(stock);
    const cartItem = posState.cart.find(item => item.product_id === product.id);
    const inCart = cartItem ? cartItem.qty : 0;
    const disabled = stock <= 0 ? 'disabled' : '';

    return `
      <article class="sales-pos-product-card ${stock <= 0 ? 'out' : ''}">
        <div class="sales-pos-product-top">
          <span class="sales-pos-product-icon">
            <span class="material-icons-round">shopping_basket</span>
          </span>
          <span class="sales-pos-stock-badge ${stockClass}">
            ${stock} stok
          </span>
        </div>
        <h4>${escapeHtml(product.nama)}</h4>
        <p>${escapeHtml(getProductCategoryName(product))}</p>
        <div class="sales-pos-product-bottom">
          <strong>${formatRupiah(product.harga_jual)}</strong>
          <button type="button" class="sales-pos-add-btn" data-add-product="${product.id}" ${disabled}>
            ${stock <= 0 ? 'Habis' : 'Tap'}
          </button>
        </div>
        ${inCart > 0 ? `<div class="sales-pos-in-cart">${inCart} di keranjang</div>` : ''}
      </article>
    `;
  }).join('');
}

function renderOutletCart() {
  const cartItems = document.getElementById('sales-pos-cart-items');
  const itemPill = document.getElementById('sales-pos-cart-count-pill');
  const totalPcs = document.getElementById('sales-pos-total-pcs');
  const totalAmount = document.getElementById('sales-pos-total-amount');
  const checkoutBtn = document.getElementById('sales-pos-checkout');
  const dayCount = document.getElementById('sales-pos-day-count');

  if (!cartItems || !itemPill || !totalPcs || !totalAmount || !checkoutBtn || !dayCount) return;

  const itemCount = getCartItemCount();
  const totalQty = getCartTotalPcs();
  const grandTotal = getCartTotalAmount();

  itemPill.textContent = `${itemCount} item`;
  totalPcs.textContent = `${totalQty} pcs`;
  totalAmount.textContent = formatRupiah(grandTotal);
  dayCount.textContent = String(posState.dayTransactionCount);

  checkoutBtn.disabled = posState.processingCheckout || itemCount === 0;
  checkoutBtn.textContent = posState.processingCheckout ? 'Memproses transaksi...' : 'Selesaikan transaksi';

  if (!itemCount) {
    cartItems.innerHTML = `
      <div class="sales-pos-empty cart">
        <span class="material-icons-round">shopping_cart</span>
        <h4>Keranjang masih kosong</h4>
        <p>Tambahkan produk dari panel kiri untuk mulai transaksi.</p>
      </div>
    `;
    return;
  }

  cartItems.innerHTML = posState.cart.map(item => `
    <div class="sales-pos-cart-item">
      <button type="button" class="sales-pos-remove-btn" data-remove-product="${item.product_id}">
        <span class="material-icons-round">close</span>
      </button>
      <h4>${escapeHtml(item.nama)}</h4>
      <p>${formatRupiah(item.harga_jual)} per item</p>
      <div class="sales-pos-cart-item-bottom">
        <div class="sales-pos-qty-control">
          <button type="button" data-qty-change="-1" data-product-id="${item.product_id}">
            <span class="material-icons-round">remove</span>
          </button>
          <span>${item.qty}</span>
          <button type="button" data-qty-change="1" data-product-id="${item.product_id}">
            <span class="material-icons-round">add</span>
          </button>
        </div>
        <strong>${formatRupiah(item.qty * item.harga_jual)}</strong>
      </div>
    </div>
  `).join('');
}

function syncOutletPaymentButtons() {
  document.querySelectorAll('.sales-pos-pay-btn').forEach(btn => {
    const isActive = btn.dataset.payment === posState.payment;
    btn.classList.toggle('active', isActive);
  });
}

function syncOutletPOSView() {
  renderOutletCategoryFilters();
  renderOutletProductsGrid();
  renderOutletCart();
  syncOutletPaymentButtons();
}

function addOutletProductToCart(productId) {
  const product = getOutletActiveProducts().find(item => item.id === productId);
  if (!product) return;

  const stock = getOutletStock(productId);
  if (stock <= 0) {
    notify.warning(`Stok ${product.nama} habis.`);
    return;
  }

  const existing = posState.cart.find(item => item.product_id === productId);
  if (existing) {
    if (existing.qty >= stock) {
      notify.warning(`Stok ${product.nama} tidak mencukupi.`);
      return;
    }
    existing.qty += 1;
  } else {
    posState.cart.push({
      product_id: product.id,
      nama: product.nama,
      harga_jual: Number(product.harga_jual || 0),
      hpp: Number(product.hpp || 0),
      qty: 1,
    });
  }

  syncOutletPOSView();
}

function updateOutletCartQty(productId, delta) {
  const target = posState.cart.find(item => item.product_id === productId);
  if (!target) return;

  const maxStock = getOutletStock(productId);
  const nextQty = target.qty + delta;

  if (nextQty <= 0) {
    posState.cart = posState.cart.filter(item => item.product_id !== productId);
    syncOutletPOSView();
    return;
  }

  if (nextQty > maxStock) {
    notify.warning(`Jumlah melebihi stok tersedia (${maxStock}).`);
    return;
  }

  target.qty = nextQty;
  syncOutletPOSView();
}

function removeOutletCartItem(productId) {
  posState.cart = posState.cart.filter(item => item.product_id !== productId);
  syncOutletPOSView();
}

async function refreshOutletPOSData() {
  const outletId = auth.getOutletId();
  if (!outletId) return;

  const [stockData, daySales] = await Promise.all([
    api.getOutletStock(outletId),
    api.getSales({ outlet_id: outletId, date_from: posState.date, date_to: posState.date }),
  ]);

  posState.stockMap = {};
  stockData.forEach(row => {
    posState.stockMap[row.product_id] = Number(row.stok_tersedia || 0);
  });

  posState.dayTransactionCount = daySales.length;
  posState.cart = posState.cart
    .map(item => ({ ...item, qty: Math.min(item.qty, getOutletStock(item.product_id)) }))
    .filter(item => item.qty > 0);
}

async function checkoutOutletPOS() {
  if (posState.processingCheckout) return;
  if (!posState.cart.length) {
    notify.warning('Keranjang masih kosong.');
    return;
  }

  const outletId = auth.getOutletId();
  if (!outletId) {
    notify.error('Outlet pengguna tidak ditemukan.');
    return;
  }

  const overStockItem = posState.cart.find(item => item.qty > getOutletStock(item.product_id));
  if (overStockItem) {
    notify.error(`Stok ${overStockItem.nama} tidak mencukupi.`);
    return;
  }

  posState.processingCheckout = true;
  renderOutletCart();

  const notesPieces = [];
  if (posState.notes.trim()) notesPieces.push(posState.notes.trim());
  notesPieces.push(`Metode: ${posState.payment.toUpperCase()}`);
  const combinedNotes = notesPieces.join(' | ');

  const payloadItems = posState.cart.map(item => ({
    product_id: item.product_id,
    jumlah: item.qty,
    harga_jual: item.harga_jual,
    hpp: item.hpp,
  }));

  try {
    await api.createSale(outletId, payloadItems, posState.date, combinedNotes);
    notify.success('Transaksi berhasil disimpan.');

    posState.cart = [];
    posState.notes = '';
    const notesEl = document.getElementById('sales-pos-notes');
    if (notesEl) notesEl.value = '';

    await refreshOutletPOSData();
    syncOutletPOSView();
  } catch (err) {
    notify.error('Gagal menyimpan transaksi: ' + err.message);
  } finally {
    posState.processingCheckout = false;
    renderOutletCart();
  }
}

function bindOutletPOSEvents() {
  const root = document.getElementById('sales-pos-root');
  if (!root) return;

  root.addEventListener('click', async (event) => {
    const categoryBtn = event.target.closest('[data-category]');
    if (categoryBtn) {
      posState.category = categoryBtn.dataset.category || 'all';
      renderOutletCategoryFilters();
      renderOutletProductsGrid();
      return;
    }

    const addBtn = event.target.closest('[data-add-product]');
    if (addBtn) {
      addOutletProductToCart(addBtn.dataset.addProduct);
      return;
    }

    const qtyBtn = event.target.closest('[data-qty-change]');
    if (qtyBtn) {
      const delta = Number(qtyBtn.dataset.qtyChange || 0);
      const productId = qtyBtn.dataset.productId;
      if (productId && delta) updateOutletCartQty(productId, delta);
      return;
    }

    const removeBtn = event.target.closest('[data-remove-product]');
    if (removeBtn) {
      removeOutletCartItem(removeBtn.dataset.removeProduct);
      return;
    }

    const payBtn = event.target.closest('[data-payment]');
    if (payBtn) {
      posState.payment = payBtn.dataset.payment || 'tunai';
      syncOutletPaymentButtons();
      return;
    }

    const checkoutBtn = event.target.closest('#sales-pos-checkout');
    if (checkoutBtn) {
      await checkoutOutletPOS();
    }
  });

  document.getElementById('sales-pos-search')?.addEventListener('input', (event) => {
    posState.search = event.target.value || '';
    renderOutletProductsGrid();
  });

  document.getElementById('sales-pos-notes')?.addEventListener('input', (event) => {
    posState.notes = event.target.value || '';
  });

  document.getElementById('sales-pos-date')?.addEventListener('change', async (event) => {
    posState.date = event.target.value || toISODate(new Date());
    await refreshOutletPOSData();
    syncOutletPOSView();
  });
}

async function openNewSaleModalForAdmin() {
  const outletId = '';
  const activeProducts = products.filter(p => p.is_active);
  if (!activeProducts.length) {
    notify.warning('Belum ada produk aktif untuk dicatat.');
    return;
  }

  const productsOptions = activeProducts.map(p => (
    `<option value="${p.id}" data-harga="${p.harga_jual}" data-hpp="${p.hpp}">${escapeHtml(p.nama)} - ${formatRupiah(p.harga_jual)}</option>`
  )).join('');

  const formHtml = `
    <div class="form-group">
      <label class="form-label">Outlet *</label>
      <select class="form-select" id="f-sale-outlet">
        ${outlets.map(o => `<option value="${o.id}">${escapeHtml(o.nama)}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">Tanggal</label>
      <input type="date" class="form-input" id="f-sale-date" value="${toISODate(new Date())}">
    </div>
    <div id="sale-items">
      <div class="form-row sale-item" data-idx="0">
        <div class="form-group" style="flex:2;">
          <label class="form-label">Produk</label>
          <select class="form-select si-product" onchange="
            const opt = this.options[this.selectedIndex];
            const parent = this.closest('.sale-item');
            parent.querySelector('.si-harga').value = opt?.dataset?.harga || 0;
          ">${productsOptions}</select>
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Jumlah</label>
          <input type="number" class="form-input si-jumlah" value="1" min="1">
        </div>
        <div class="form-group" style="flex:1;">
          <label class="form-label">Harga</label>
          <input type="number" class="form-input si-harga" value="${activeProducts[0]?.harga_jual || 0}">
        </div>
      </div>
    </div>
    <button type="button" class="btn btn-ghost btn-sm mt-4" id="add-sale-item">
      <span class="material-icons-round">add</span> Tambah Item
    </button>
    <div class="form-group mt-4">
      <label class="form-label">Catatan</label>
      <textarea class="form-textarea" id="f-sale-notes" placeholder="Catatan (opsional)"></textarea>
    </div>
  `;

  const result = await openModal('Catat Penjualan', formHtml, {
    confirmText: 'Simpan Penjualan',
    size: 'lg',
    onOpen: (modal) => {
      modal.querySelector('#add-sale-item')?.addEventListener('click', () => {
        const container = modal.querySelector('#sale-items');
        const div = document.createElement('div');
        div.className = 'form-row sale-item';
        div.innerHTML = `
          <div class="form-group" style="flex:2;">
            <select class="form-select si-product" onchange="
              const opt = this.options[this.selectedIndex];
              const parent = this.closest('.sale-item');
              parent.querySelector('.si-harga').value = opt?.dataset?.harga || 0;
            ">${productsOptions}</select>
          </div>
          <div class="form-group" style="flex:1;">
            <input type="number" class="form-input si-jumlah" value="1" min="1">
          </div>
          <div class="form-group" style="flex:1;">
            <input type="number" class="form-input si-harga" value="${activeProducts[0]?.harga_jual || 0}">
          </div>
          <button type="button" class="btn btn-ghost btn-sm text-danger" onclick="this.parentElement.remove()">
            <span class="material-icons-round">delete</span>
          </button>
        `;
        container.appendChild(div);
      });
    },
    onConfirm: () => {
      const items = [];
      document.querySelectorAll('.sale-item').forEach(row => {
        const select = row.querySelector('.si-product');
        const productId = select?.value;
        const hpp = select && select.options ? Number(select.options[select.selectedIndex]?.dataset?.hpp || 0) : 0;
        const jumlah = Number(row.querySelector('.si-jumlah')?.value || 0);
        const hargaJual = Number(row.querySelector('.si-harga')?.value || 0);
        if (productId && jumlah > 0) items.push({ product_id: productId, jumlah, harga_jual: hargaJual, hpp });
      });

      return {
        outlet_id: document.getElementById('f-sale-outlet')?.value || outletId,
        tanggal: document.getElementById('f-sale-date')?.value,
        notes: document.getElementById('f-sale-notes')?.value,
        items,
      };
    },
  });

  if (result && result.items?.length > 0 && result.outlet_id) {
    try {
      await api.createSale(result.outlet_id, result.items, result.tanggal, result.notes);
      notify.success('Penjualan berhasil dicatat');
      await loadBackofficeSales({
        date_from: document.getElementById('filter-date-from')?.value,
        date_to: document.getElementById('filter-date-to')?.value,
        outlet_id: document.getElementById('filter-outlet')?.value || '',
      });
    } catch (err) {
      notify.error('Gagal mencatat penjualan: ' + err.message);
    }
  }
}

async function initBackofficeSales() {
  outlets = await api.getOutlets();
  const outletSelect = document.getElementById('filter-outlet');
  if (outletSelect) {
    outlets.forEach(outlet => {
      outletSelect.innerHTML += `<option value="${outlet.id}">${escapeHtml(outlet.nama)}</option>`;
    });
  }

  await loadBackofficeSales({
    date_from: document.getElementById('filter-date-from')?.value,
    date_to: document.getElementById('filter-date-to')?.value,
  });

  document.getElementById('btn-filter-sales')?.addEventListener('click', () => {
    loadBackofficeSales({
      outlet_id: document.getElementById('filter-outlet')?.value || '',
      date_from: document.getElementById('filter-date-from')?.value,
      date_to: document.getElementById('filter-date-to')?.value,
    });
  });

  document.getElementById('btn-new-sale')?.addEventListener('click', openNewSaleModalForAdmin);
}

async function initOutletSales() {
  posState.category = 'all';
  posState.search = '';
  posState.cart = [];
  posState.payment = 'tunai';
  posState.date = toISODate(new Date());
  posState.notes = '';
  posState.stockMap = {};
  posState.dayTransactionCount = 0;
  posState.processingCheckout = false;

  await refreshOutletPOSData();
  syncOutletPOSView();
  bindOutletPOSEvents();
}

export async function initSales() {
  products = await api.getProducts();
  if (auth.isOutlet()) {
    await initOutletSales();
    return;
  }
  await initBackofficeSales();
}
