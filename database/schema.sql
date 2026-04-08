-- ============================================
-- ANS - Fried Chicken Management System
-- Database Schema (Supabase / PostgreSQL)
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. OUTLETS
-- ============================================
CREATE TABLE outlets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(100) NOT NULL,
  alamat TEXT,
  telepon VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. PROFILES (extends Supabase Auth)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nama VARCHAR(100) NOT NULL,
  email VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'outlet', 'management')),
  outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 3. CATEGORIES
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(50) NOT NULL,
  deskripsi TEXT,
  icon VARCHAR(10) DEFAULT '📦',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 4. PRODUCTS
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  nama VARCHAR(100) NOT NULL,
  satuan VARCHAR(20) NOT NULL DEFAULT 'pcs',
  hpp DECIMAL(12,2) DEFAULT 0,
  margin_persen DECIMAL(5,2) DEFAULT 0,
  harga_jual DECIMAL(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 5. INGREDIENTS (Bahan Baku)
-- ============================================
CREATE TABLE ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nama VARCHAR(100) NOT NULL,
  harga_per_unit DECIMAL(12,2) NOT NULL DEFAULT 0,
  satuan VARCHAR(20) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 6. PRODUCT_RECIPES (Resep per Produk)
-- ============================================
CREATE TABLE product_recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  ingredient_id UUID REFERENCES ingredients(id) ON DELETE CASCADE,
  jumlah_per_produk DECIMAL(10,4) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, ingredient_id)
);

-- ============================================
-- 7. WAREHOUSE_STOCK (Stok Gudang Pusat)
-- ============================================
CREATE TABLE warehouse_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE UNIQUE,
  stok_tersedia INTEGER NOT NULL DEFAULT 0,
  stok_minimum INTEGER NOT NULL DEFAULT 50,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. OUTLET_STOCK (Stok per Outlet)
-- ============================================
CREATE TABLE outlet_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  outlet_id UUID REFERENCES outlets(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  stok_tersedia INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(outlet_id, product_id)
);

-- ============================================
-- 9. STOCK_REQUESTS (Permintaan Stok)
-- ============================================
CREATE TABLE stock_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_code VARCHAR(30) UNIQUE,
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  requested_by UUID REFERENCES profiles(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  notes TEXT,
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 10. STOCK_REQUEST_ITEMS
-- ============================================
CREATE TABLE stock_request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES stock_requests(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  jumlah INTEGER NOT NULL DEFAULT 0,
  jumlah_approved INTEGER DEFAULT 0
);

-- ============================================
-- 11. SALES (Penjualan)
-- ============================================
CREATE TABLE sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_code VARCHAR(30) UNIQUE,
  outlet_id UUID REFERENCES outlets(id) NOT NULL,
  recorded_by UUID REFERENCES profiles(id),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  total_amount DECIMAL(14,2) DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 12. SALE_ITEMS
-- ============================================
CREATE TABLE sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id),
  jumlah INTEGER NOT NULL DEFAULT 0,
  harga_jual DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(14,2) NOT NULL DEFAULT 0
);

-- ============================================
-- 13. ACTIVITY_LOGS (Notifikasi / Audit Log)
-- ============================================
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  actor_role VARCHAR(20) CHECK (actor_role IN ('admin', 'outlet', 'management')),
  outlet_id UUID REFERENCES outlets(id) ON DELETE SET NULL,
  action VARCHAR(30) NOT NULL DEFAULT 'update',
  entity_type VARCHAR(40) NOT NULL DEFAULT 'system',
  entity_id UUID,
  title VARCHAR(160) NOT NULL,
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_outlet ON profiles(outlet_id);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_warehouse_stock_product ON warehouse_stock(product_id);
CREATE INDEX idx_outlet_stock_outlet ON outlet_stock(outlet_id);
CREATE INDEX idx_outlet_stock_product ON outlet_stock(product_id);
CREATE INDEX idx_stock_requests_outlet ON stock_requests(outlet_id);
CREATE INDEX idx_stock_requests_status ON stock_requests(status);
CREATE INDEX idx_stock_requests_created ON stock_requests(created_at);
CREATE INDEX idx_sales_outlet ON sales(outlet_id);
CREATE INDEX idx_sales_tanggal ON sales(tanggal);
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX idx_sale_items_product ON sale_items(product_id);
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);
CREATE INDEX idx_activity_logs_outlet ON activity_logs(outlet_id);
CREATE INDEX idx_activity_logs_actor ON activity_logs(actor_id);

-- ============================================
-- UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_outlets_updated_at BEFORE UPDATE ON outlets FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_ingredients_updated_at BEFORE UPDATE ON ingredients FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_warehouse_stock_updated_at BEFORE UPDATE ON warehouse_stock FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER tr_outlet_stock_updated_at BEFORE UPDATE ON outlet_stock FOR EACH ROW EXECUTE FUNCTION update_updated_at();
