import { supabase } from '../config/supabase.js';
import { auth } from './auth.js';

// ======== OUTLETS ========
export async function getOutlets() {
  const { data, error } = await supabase.from('outlets').select('*').order('nama');
  if (error) throw error;
  return data;
}

export async function getOutlet(id) {
  const { data, error } = await supabase.from('outlets').select('*').eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createOutlet(outlet) {
  const { data, error } = await supabase.from('outlets').insert(outlet).select().single();
  if (error) throw error;
  return data;
}

export async function updateOutlet(id, updates) {
  const { data, error } = await supabase.from('outlets').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteOutlet(id) {
  const { error } = await supabase.from('outlets').delete().eq('id', id);
  if (error) throw error;
}

// ======== CATEGORIES ========
export async function getCategories() {
  const { data, error } = await supabase.from('categories').select('*').order('nama');
  if (error) throw error;
  return data;
}

export async function createCategory(cat) {
  const { data, error } = await supabase.from('categories').insert(cat).select().single();
  if (error) throw error;
  return data;
}

// ======== PRODUCTS ========
export async function getProducts() {
  const { data, error } = await supabase.from('products')
    .select('*, categories(nama, icon)')
    .order('nama');
  if (error) throw error;
  return data;
}

export async function getProduct(id) {
  const { data, error } = await supabase.from('products')
    .select('*, categories(nama, icon)')
    .eq('id', id).single();
  if (error) throw error;
  return data;
}

export async function createProduct(product) {
  const { data, error } = await supabase.from('products').insert(product).select().single();
  if (error) throw error;
  // Also create warehouse_stock entry
  await supabase.from('warehouse_stock').insert({ product_id: data.id, stok_tersedia: 0, stok_minimum: 50 });
  return data;
}

export async function updateProduct(id, updates) {
  const { data, error } = await supabase.from('products').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id) {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) throw error;
}

// ======== INGREDIENTS ========
export async function getIngredients() {
  const { data, error } = await supabase.from('ingredients').select('*').order('nama');
  if (error) throw error;
  return data;
}

export async function createIngredient(ing) {
  const { data, error } = await supabase.from('ingredients').insert(ing).select().single();
  if (error) throw error;
  return data;
}

export async function updateIngredient(id, updates) {
  const { data, error } = await supabase.from('ingredients').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteIngredient(id) {
  const { error } = await supabase.from('ingredients').delete().eq('id', id);
  if (error) throw error;
}

// ======== PRODUCT RECIPES ========
export async function getRecipes(productId) {
  const { data, error } = await supabase.from('product_recipes')
    .select('*, ingredients(nama, harga_per_unit, satuan)')
    .eq('product_id', productId);
  if (error) throw error;
  return data;
}

export async function getFullHppBreakdown(productId) {
  const { data, error } = await supabase.rpc('calculate_hpp_full', { p_product_id: productId });
  if (error) throw error;
  return data[0]; // Returns single row with the breakdown
}

export async function upsertRecipe(recipe) {
  const { data, error } = await supabase.from('product_recipes')
    .upsert(recipe, { onConflict: 'product_id,ingredient_id' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function deleteRecipe(productId, ingredientId) {
  const { error } = await supabase.from('product_recipes')
    .delete()
    .match({ product_id: productId, ingredient_id: ingredientId });
  if (error) throw error;
}

// ======== WAREHOUSE STOCK ========
export async function getWarehouseStock() {
  const { data, error } = await supabase.from('warehouse_stock')
    .select('*, products(nama, satuan, categories(nama, icon))')
    .order('stok_tersedia', { ascending: true });
  if (error) throw error;
  return data;
}

export async function updateWarehouseStock(id, updates) {
  const { data, error } = await supabase.from('warehouse_stock').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ======== OUTLET STOCK ========
export async function getOutletStock(outletId) {
  let query = supabase.from('outlet_stock')
    .select('*, products(nama, satuan, categories(nama, icon)), outlets(nama, alamat)');
  if (outletId) query = query.eq('outlet_id', outletId);
  const { data, error } = await query.order('stok_tersedia', { ascending: true });
  if (error) throw error;
  return data;
}

// ======== STOCK REQUESTS ========
export async function getStockRequests(filters = {}) {
  let query = supabase.from('stock_requests')
    .select('*, outlets(nama), profiles!stock_requests_requested_by_fkey(nama), stock_request_items(*, products(nama, satuan))');
  
  if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
  if (filters.status) query = query.eq('status', filters.status);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
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
  return data;
}

// ======== SALES ========
export async function getSales(filters = {}) {
  let query = supabase.from('sales')
    .select('*, outlets(nama), profiles!sales_recorded_by_fkey(nama), sale_items(*, products(nama, satuan))');
  
  if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
  if (filters.date_from) query = query.gte('tanggal', filters.date_from);
  if (filters.date_to) query = query.lte('tanggal', filters.date_to);
  
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function createSale(outletId, items, tanggal, notes) {
  const totalAmount = items.reduce((sum, i) => sum + (i.jumlah * i.harga_jual), 0);

  const { data: sale, error: saleError } = await supabase.from('sales')
    .insert({
      outlet_id: outletId,
      recorded_by: auth.user.id,
      tanggal: tanggal || new Date().toISOString().split('T')[0],
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

  return sale;
}

// ======== DASHBOARD STATS ========
export async function getDashboardStats() {
  const today = new Date().toISOString().split('T')[0];
  
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

  let todayRevenue = 0;
  let todayProfit = 0;
  (todaySales || []).forEach(s => {
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
    todaySalesCount: todaySales?.length || 0,
    lowStockItems,
    lowStockCount: lowStockItems.length,
  };
}

// ======== REPORTS ========
export async function getSalesReport(filters = {}) {
  let query = supabase.from('sales')
    .select('tanggal, total_amount, outlet_id, outlets(nama), sale_items(jumlah, hpp_saat_ini, harga_jual)');
  if (filters.date_from) query = query.gte('tanggal', filters.date_from);
  if (filters.date_to) query = query.lte('tanggal', filters.date_to);
  if (filters.outlet_id) query = query.eq('outlet_id', filters.outlet_id);
  const { data, error } = await query.order('tanggal');
  if (error) throw error;
  return data;
}

export async function getSalesByOutlet(filters = {}) {
  let query = supabase.from('sales')
    .select('outlet_id, total_amount, outlets(nama), sale_items(jumlah, hpp_saat_ini, harga_jual)');
  if (filters.date_from) query = query.gte('tanggal', filters.date_from);
  if (filters.date_to) query = query.lte('tanggal', filters.date_to);
  const { data, error } = await query;
  if (error) throw error;

  // Aggregate by outlet
  const map = {};
  (data || []).forEach(s => {
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
}

export async function getProfitReport() {
  const { data, error } = await supabase.from('products')
    .select('nama, hpp, harga_jual, margin_persen, categories(nama)')
    .eq('is_active', true)
    .order('nama');
  if (error) throw error;
  return data;
}

// ======== HPP CONFIG ========
export async function getHppConfig() {
  const { data, error } = await supabase.from('hpp_cost_config').select('*').limit(1).single();
  // It's okay if it throws row not found, but we should handle it gracefully in the UI
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 is multiple (or no) rows returned
  return data || null;
}

export async function updateHppConfig(id, updates) {
  if (!id) {
    // If no config exists, insert it
    const { data, error } = await supabase.from('hpp_cost_config').insert(updates).select().single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase.from('hpp_cost_config').update(updates).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

