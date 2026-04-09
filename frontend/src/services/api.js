import { supabase } from '../config/supabase.js';
import { auth } from './auth.js';
import { recordActivity } from './activity-log.js';
import { toISODate } from '../utils/helpers.js';

const CACHE_TTL_MS = 5 * 60 * 1000;
const apiCache = new Map();
const SOFT_DELETE_TAG = '[ANS_DELETED]';

function cacheKey(scope, params = null) {
  return `${scope}:${JSON.stringify(params)}`;
}

function cloneData(data) {
  if (data == null) return data;
  if (typeof structuredClone === 'function') return structuredClone(data);
  return JSON.parse(JSON.stringify(data));
}

function pruneExpiredCache() {
  const now = Date.now();
  for (const [key, entry] of apiCache.entries()) {
    if (!entry?.timestamp) continue;
    if ((now - entry.timestamp) >= CACHE_TTL_MS && !entry.promise) {
      apiCache.delete(key);
    }
  }
}

async function cachedQuery(scope, params, fetcher) {
  pruneExpiredCache();
  const key = cacheKey(scope, params);
  const now = Date.now();
  const entry = apiCache.get(key);

  if (entry?.data && (now - entry.timestamp) < CACHE_TTL_MS) {
    return cloneData(entry.data);
  }

  if (entry?.promise) {
    const pendingData = await entry.promise;
    return cloneData(pendingData);
  }

  const promise = fetcher()
    .then((data) => {
      apiCache.set(key, { data, timestamp: Date.now() });
      return data;
    })
    .catch((err) => {
      apiCache.delete(key);
      throw err;
    });

  apiCache.set(key, {
    data: entry?.data ?? null,
    timestamp: entry?.timestamp ?? 0,
    promise,
  });

  const data = await promise;
  return cloneData(data);
}

export function clearApiCache() {
  apiCache.clear();
}

function invalidateCache() {
  clearApiCache();
}

function queueActivityLog(payload) {
  void recordActivity(payload).catch(() => {
    // Logging tidak boleh memblokir operasi utama.
  });
}

function isMissingRpcError(error) {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  return (
    code === 'PGRST202' ||
    message.includes('delete_sale_with_stock_restore') && message.includes('not found')
  );
}

function isDeletePermissionError(error) {
  const code = error?.code || '';
  const message = String(error?.message || '').toLowerCase();
  return (
    code === '42501' ||
    message.includes('permission denied') ||
    message.includes('row-level security')
  );
}

function isSoftDeletedSale(sale) {
  const notes = String(sale?.notes || '');
  return notes.includes(SOFT_DELETE_TAG);
}

function filterSoftDeletedSales(rows) {
  return (rows || []).filter(row => !isSoftDeletedSale(row));
}

// ======== OUTLETS ========
export async function getOutlets() {
  return cachedQuery('outlets:list', null, async () => {
    const { data, error } = await supabase.from('outlets').select('*').order('nama');
    if (error) throw error;
    return data;
  });
}

export async function getOutlet(id) {
  return cachedQuery('outlets:detail', { id }, async () => {
    const { data, error } = await supabase.from('outlets').select('*').eq('id', id).single();
    if (error) throw error;
    return data;
  });
}

export async function createOutlet(outlet) {
  const { data, error } = await supabase.from('outlets').insert(outlet).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'create',
    entity_type: 'outlet',
    entity_id: data.id,
    outlet_id: data.id,
    title: 'Outlet ditambahkan',
    description: `Outlet ${data.nama} berhasil dibuat.`,
  });
  return data;
}

export async function updateOutlet(id, updates) {
  const { data, error } = await supabase.from('outlets').update(updates).eq('id', id).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'update',
    entity_type: 'outlet',
    entity_id: id,
    outlet_id: data?.id || id,
    title: 'Outlet diperbarui',
    description: `Perubahan data outlet ${data?.nama || ''}`.trim(),
  });
  return data;
}

export async function deleteOutlet(id) {
  const { error } = await supabase.from('outlets').delete().eq('id', id);
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'delete',
    entity_type: 'outlet',
    entity_id: id,
    outlet_id: id,
    title: 'Outlet dihapus',
    description: 'Satu outlet telah dihapus dari sistem.',
  });
}

// ======== CATEGORIES ========
export async function getCategories() {
  return cachedQuery('categories:list', null, async () => {
    const { data, error } = await supabase.from('categories').select('*').order('nama');
    if (error) throw error;
    return data;
  });
}

export async function createCategory(cat) {
  const { data, error } = await supabase.from('categories').insert(cat).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'create',
    entity_type: 'category',
    entity_id: data.id,
    title: 'Kategori ditambahkan',
    description: `Kategori ${data.nama} berhasil dibuat.`,
  });
  return data;
}

// ======== PRODUCTS ========
export async function getProducts() {
  return cachedQuery('products:list', null, async () => {
    const { data, error } = await supabase.from('products')
      .select('*, categories(nama, icon)')
      .order('nama');
    if (error) throw error;
    return data;
  });
}

export async function getProduct(id) {
  return cachedQuery('products:detail', { id }, async () => {
    const { data, error } = await supabase.from('products')
      .select('*, categories(nama, icon)')
      .eq('id', id).single();
    if (error) throw error;
    return data;
  });
}

export async function createProduct(product) {
  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw error;
  // Also create warehouse_stock entry
  await supabase.from('warehouse_stock').insert({ product_id: data.id, stok_tersedia: 0, stok_minimum: 50 });
  invalidateCache();
  queueActivityLog({
    action: 'create',
    entity_type: 'product',
    entity_id: data.id,
    title: 'Produk ditambahkan',
    description: `Produk ${data.nama} berhasil dibuat.`,
  });
  return data;
}

export async function updateProduct(id, updates) {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'update',
    entity_type: 'product',
    entity_id: id,
    title: 'Produk diperbarui',
    description: `Produk ${data?.nama || ''} diperbarui.`.trim(),
  });
  return data;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'delete',
    entity_type: 'product',
    entity_id: id,
    title: 'Produk dihapus',
    description: 'Satu produk telah dihapus dari sistem.',
  });
}

// ======== INGREDIENTS ========
export async function getIngredients() {
  return cachedQuery('ingredients:list', null, async () => {
    const { data, error } = await supabase.from('ingredients').select('*').order('nama');
    if (error) throw error;
    return data;
  });
}

export async function createIngredient(ing) {
  const { data, error } = await supabase.from('ingredients').insert(ing).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'create',
    entity_type: 'ingredient',
    entity_id: data.id,
    title: 'Bahan baku ditambahkan',
    description: `Bahan baku ${data.nama} berhasil dibuat.`,
  });
  return data;
}

export async function updateIngredient(id, updates) {
  const { data, error } = await supabase.from('ingredients').update(updates).eq('id', id).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'update',
    entity_type: 'ingredient',
    entity_id: id,
    title: 'Bahan baku diperbarui',
    description: `Bahan baku ${data?.nama || ''} diperbarui.`.trim(),
  });
  return data;
}

export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'delete',
    entity_type: 'ingredient',
    entity_id: id,
    title: 'Bahan baku dihapus',
    description: 'Satu bahan baku telah dihapus dari sistem.',
  });
}

// ======== PRODUCT RECIPES ========
export async function getRecipes(productId) {
  return cachedQuery('recipes:list', { productId }, async () => {
    const { data, error } = await supabase.from('product_recipes')
      .select('*, ingredients(nama, harga_per_unit, satuan)')
      .eq('product_id', productId);
    if (error) throw error;
    return data;
  });
}

export async function getFullHppBreakdown(productId) {
  return cachedQuery('hpp:breakdown', { productId }, async () => {
    const { data, error } = await supabase.rpc('calculate_hpp_full', { p_product_id: productId });
    if (error) throw error;
    return data[0]; // Returns single row with the breakdown
  });
}

export async function upsertRecipe(recipe) {
  const { data, error } = await supabase.from('product_recipes')
    .upsert(recipe, { onConflict: 'product_id,ingredient_id' })
    .select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'update',
    entity_type: 'recipe',
    entity_id: data.id,
    title: 'Resep produk diperbarui',
    description: 'Komposisi resep produk telah diperbarui.',
    metadata: {
      product_id: data.product_id,
      ingredient_id: data.ingredient_id,
    },
  });
  return data;
}

export async function deleteRecipe(productId, ingredientId) {
  const { error } = await supabase.from('product_recipes')
    .delete()
    .match({ product_id: productId, ingredient_id: ingredientId });
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'delete',
    entity_type: 'recipe',
    title: 'Resep produk dihapus',
    description: 'Salah satu komponen resep produk telah dihapus.',
    metadata: { product_id: productId, ingredient_id: ingredientId },
  });
}

// ======== WAREHOUSE STOCK ========
export async function getWarehouseStock() {
  return cachedQuery('warehouse:stock', null, async () => {
    const { data, error } = await supabase.from('warehouse_stock')
      .select('*, products(nama, satuan, categories(nama, icon))')
      .order('stok_tersedia', { ascending: true });
    if (error) throw error;
    return data;
  });
}

export async function updateWarehouseStock(id, updates) {
  const { data, error } = await supabase.from('warehouse_stock').update(updates).eq('id', id).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'update',
    entity_type: 'warehouse_stock',
    entity_id: data.id,
    title: 'Stok gudang diperbarui',
    description: 'Stok gudang pusat telah diperbarui.',
    metadata: { product_id: data.product_id, stok_tersedia: data.stok_tersedia },
  });
  return data;
}

// ======== OUTLET STOCK ========
export async function getOutletStock(outletId) {
  return cachedQuery('outlet:stock', { outletId: outletId || null }, async () => {
    let query = supabase.from('outlet_stock')
      .select('*, products(nama, satuan, categories(nama, icon)), outlets(nama, alamat)');
    if (outletId) query = query.eq('outlet_id', outletId);
    const { data, error } = await query.order('stok_tersedia', { ascending: true });
    if (error) throw error;
    return data;
  });
}

// ======== STOCK REQUESTS ========
export async function getStockRequests(filters = {}) {
  return cachedQuery('stock:requests', filters, async () => {
    let query = supabase.from('stock_requests')
      .select('*, outlets(nama), profiles!stock_requests_requested_by_fkey(nama), stock_request_items(*, products(nama, satuan))');
    
    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    if (filters.status) query = query.eq('status', filters.status);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return data;
  });
}

export async function createStockRequest(outletId, items, notes) {
  // Create request
  const { data: request, error: reqError } = await supabase.from('stock_requests')
    .insert({
      outlet_id: outletId,
      requested_by: auth.user.id,
      notes
    }).select().single();
  if (reqError) throw reqError;

  // Create items
  const itemsData = items.map(item => ({
    request_id: request.id,
    product_id: item.product_id,
    jumlah: item.jumlah,
  }));

  const { error: itemsError } = await supabase.from('stock_request_items').insert(itemsData);
  if (itemsError) throw itemsError;

  invalidateCache();
  queueActivityLog({
    action: 'create',
    entity_type: 'stock_request',
    entity_id: request.id,
    outlet_id: request.outlet_id,
    title: 'Permintaan stok baru',
    description: `Permintaan ${request.request_code || 'stok'} dibuat (${items.length} item).`,
  });
  return request;
}

export async function approveStockRequest(requestId, items) {
  // Update approved amounts
  for (const item of items) {
    await supabase.from('stock_request_items')
      .update({ jumlah_approved: item.jumlah_approved })
      .eq('id', item.id);
  }

  // Update request status
  const { data, error } = await supabase.from('stock_requests')
    .update({
      status: 'approved',
      approved_by: auth.user.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'approve',
    entity_type: 'stock_request',
    entity_id: requestId,
    outlet_id: data.outlet_id,
    title: 'Permintaan stok disetujui',
    description: `Permintaan ${data.request_code || requestId} telah disetujui.`,
  });
  return data;
}

export async function rejectStockRequest(requestId) {
  const { data, error } = await supabase.from('stock_requests')
    .update({
      status: 'rejected',
      approved_by: auth.user.id,
      approved_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'reject',
    entity_type: 'stock_request',
    entity_id: requestId,
    outlet_id: data.outlet_id,
    title: 'Permintaan stok ditolak',
    description: `Permintaan ${data.request_code || requestId} telah ditolak.`,
  });
  return data;
}

// ======== SALES ========
export async function getSales(filters = {}) {
  return cachedQuery('sales:list', filters, async () => {
    let query = supabase.from('sales')
      .select('*, outlets(nama), profiles!sales_recorded_by_fkey(nama), sale_items(*, products(nama, satuan))');
    
    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    if (filters.date_from) query = query.gte('tanggal', filters.date_from);
    if (filters.date_to) query = query.lte('tanggal', filters.date_to);
    
    const { data, error } = await query.order('created_at', { ascending: false });
    if (error) throw error;
    return filterSoftDeletedSales(data);
  });
}

export async function createSale(outletId, items, tanggal, notes) {
  const totalAmount = items.reduce((sum, i) => sum + (i.jumlah * i.harga_jual), 0);

  const { data: sale, error: saleError } = await supabase.from('sales')
    .insert({
      outlet_id: outletId,
      recorded_by: auth.user.id,
      tanggal: tanggal || toISODate(new Date()),
      total_amount: totalAmount,
      notes
    }).select().single();
  if (saleError) throw saleError;

  const itemsData = items.map(item => ({
    sale_id: sale.id,
    product_id: item.product_id,
    jumlah: item.jumlah,
    harga_jual: item.harga_jual,
    hpp_saat_ini: item.hpp || 0,
    subtotal: item.jumlah * item.harga_jual
  }));

  const { error: itemsError } = await supabase.from('sale_items').insert(itemsData);
  if (itemsError) throw itemsError;

  invalidateCache();
  queueActivityLog({
    action: 'checkout',
    entity_type: 'sale',
    entity_id: sale.id,
    outlet_id: sale.outlet_id,
    title: 'Transaksi penjualan baru',
    description: `Transaksi ${sale.sale_code || sale.id} tersimpan (${items.length} item).`,
    metadata: { total_amount: sale.total_amount },
  });
  return sale;
}

export async function deleteSale(saleId) {
  const { data: rpcDeletedSale, error: rpcError } = await supabase.rpc('delete_sale_with_stock_restore', {
    p_sale_id: saleId,
  });

  let deletedSale = null;
  if (!rpcError) {
    deletedSale = Array.isArray(rpcDeletedSale) ? rpcDeletedSale[0] : rpcDeletedSale;
  } else if (!isMissingRpcError(rpcError) && !isDeletePermissionError(rpcError)) {
    throw rpcError;
  }

  if (!deletedSale) {
    const { data: sale, error: saleError } = await supabase.from('sales')
      .select('id, sale_code, outlet_id, total_amount, sale_items(product_id, jumlah)')
      .eq('id', saleId)
      .single();
    if (saleError) throw saleError;

    const itemMap = new Map();
    (sale.sale_items || []).forEach(item => {
      const prevQty = itemMap.get(item.product_id) || 0;
      itemMap.set(item.product_id, prevQty + Number(item.jumlah || 0));
    });

    const productIds = Array.from(itemMap.keys());
    if (productIds.length > 0) {
      const { data: stockRows, error: stockError } = await supabase.from('outlet_stock')
        .select('product_id, stok_tersedia')
        .eq('outlet_id', sale.outlet_id)
        .in('product_id', productIds);
      if (stockError && !isDeletePermissionError(stockError)) throw stockError;

      if (!stockError) {
        const stockMap = new Map((stockRows || []).map(row => [row.product_id, Number(row.stok_tersedia || 0)]));
        const restoreRows = productIds.map(productId => ({
          outlet_id: sale.outlet_id,
          product_id: productId,
          stok_tersedia: (stockMap.get(productId) || 0) + (itemMap.get(productId) || 0),
          updated_at: new Date().toISOString(),
        }));

        const { error: restoreError } = await supabase.from('outlet_stock')
          .upsert(restoreRows, { onConflict: 'outlet_id,product_id' });
        if (restoreError && !isDeletePermissionError(restoreError)) throw restoreError;
      }
    }

    const { error: deleteError } = await supabase.from('sales').delete().eq('id', saleId);
    if (!deleteError) {
      deletedSale = sale;
    } else if (!isDeletePermissionError(deleteError)) {
      throw deleteError;
    } else {
      const originalNotes = sale.notes ? String(sale.notes) : '';
      const deleteStamp = `${SOFT_DELETE_TAG} ${new Date().toISOString()}`;
      const updatedNotes = [deleteStamp, originalNotes].filter(Boolean).join('\n');
      const { data: softDeletedSale, error: softDeleteError } = await supabase.from('sales')
        .update({
          total_amount: 0,
          notes: updatedNotes,
        })
        .eq('id', saleId)
        .select('id, sale_code, outlet_id, total_amount, notes')
        .single();

      if (softDeleteError) throw softDeleteError;
      deletedSale = softDeletedSale;
    }
  }

  invalidateCache();
  queueActivityLog({
    action: 'delete',
    entity_type: 'sale',
    entity_id: deletedSale.id || saleId,
    outlet_id: deletedSale.outlet_id || null,
    title: 'Transaksi dihapus',
    description: `Transaksi ${deletedSale.sale_code || saleId} telah dihapus.`,
    metadata: { total_amount: deletedSale.total_amount || 0 },
  });
  return deletedSale;
}

// ======== DASHBOARD STATS ========
export async function getDashboardStats() {
  const today = toISODate(new Date());
  return cachedQuery('dashboard:stats', { today }, async () => {
    const [
      { count: totalOutlets },
      { count: pendingRequests },
      { data: todaySales },
      { data: warehouseAlerts },
    ] = await Promise.all([
      supabase.from('outlets').select('*', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('stock_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('sales').select('total_amount, sale_items(jumlah, hpp_saat_ini, harga_jual)').eq('tanggal', today),
      supabase.from('warehouse_stock').select('*, products(nama, satuan)'),
    ]);

    const visibleTodaySales = filterSoftDeletedSales(todaySales || []);

    let todayRevenue = 0;
    let todayProfit = 0;
    visibleTodaySales.forEach(s => {
      todayRevenue += Number(s.total_amount);
      (s.sale_items || []).forEach(item => {
        todayProfit += (Number(item.harga_jual) - Number(item.hpp_saat_ini)) * Number(item.jumlah);
      });
    });

    const lowStockItems = (warehouseAlerts || []).filter(s => s.stok_tersedia <= s.stok_minimum);

    return {
      totalOutlets: totalOutlets || 0,
      pendingRequests: pendingRequests || 0,
      todayRevenue,
      todayProfit,
      todaySalesCount: visibleTodaySales.length,
      lowStockItems,
      lowStockCount: lowStockItems.length,
    };
  });
}

// ======== REPORTS ========
export async function getSalesReport(filters = {}) {
  return cachedQuery('reports:sales', filters, async () => {
    let query = supabase.from('sales')
      .select('tanggal, total_amount, outlet_id, outlets(nama), sale_items(jumlah, hpp_saat_ini, harga_jual)');
    if (filters.date_from) query = query.gte('tanggal', filters.date_from);
    if (filters.date_to) query = query.lte('tanggal', filters.date_to);
    if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
    const { data, error } = await query.order('tanggal');
    if (error) throw error;
    return filterSoftDeletedSales(data);
  });
}

export async function getSalesByOutlet(filters = {}) {
  return cachedQuery('reports:sales-by-outlet', filters, async () => {
    let query = supabase.from('sales')
      .select('outlet_id, total_amount, outlets(nama), sale_items(jumlah, hpp_saat_ini, harga_jual)');
    if (filters.date_from) query = query.gte('tanggal', filters.date_from);
    if (filters.date_to) query = query.lte('tanggal', filters.date_to);
    const { data, error } = await query;
    if (error) throw error;
    const visibleSales = filterSoftDeletedSales(data);

    // Aggregate by outlet
    const map = {};
    visibleSales.forEach(s => {
      const key = s.outlet_id;
      if (!map[key]) map[key] = { outlet: s.outlets?.nama || 'Unknown', total: 0, count: 0, profit: 0 };
      map[key].total += Number(s.total_amount);
      map[key].count++;
      
      // Calculate laba bersih for this sale
      let saleProfit = 0;
      (s.sale_items || []).forEach(item => {
        const margin = Number(item.harga_jual) - Number(item.hpp_saat_ini || 0);
        saleProfit += margin * Number(item.jumlah);
      });
      map[key].profit += saleProfit;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  });
}

export async function getProfitReport() {
  return cachedQuery('reports:profit', null, async () => {
    const { data, error } = await supabase.from('products')
      .select('nama, hpp, harga_jual, margin_persen, categories(nama)')
      .eq('is_active', true)
      .order('nama');
    if (error) throw error;
    return data;
  });
}

// ======== HPP CONFIG ========
export async function getHppConfig() {
  return cachedQuery('hpp:config', null, async () => {
    const { data, error } = await supabase.from('hpp_cost_config').select('*').limit(1).single();
    // It's okay if it throws row not found, but we should handle it gracefully in the UI
    if (error && error.code !== 'PGRST116') throw error; // PGRST116 is multiple (or no) rows returned
    return data || null;
  });
}

export async function updateHppConfig(id, updates) {
  if (!id) {
    // If no config exists, insert it
    const { data, error } = await supabase.from('hpp_cost_config').insert(updates).select().single();
    if (error) throw error;
    invalidateCache();
    queueActivityLog({
      action: 'create',
      entity_type: 'hpp_config',
      entity_id: data.id,
      title: 'Konfigurasi HPP dibuat',
      description: 'Konfigurasi biaya HPP pertama kali disimpan.',
    });
    return data;
  }
  const { data, error } = await supabase.from('hpp_cost_config').update(updates).eq('id', id).select().single();
  if (error) throw error;
  invalidateCache();
  queueActivityLog({
    action: 'update',
    entity_type: 'hpp_config',
    entity_id: id,
    title: 'Konfigurasi HPP diperbarui',
    description: 'Konfigurasi biaya HPP telah diperbarui.',
  });
  return data;
}
