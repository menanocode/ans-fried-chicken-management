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
  icon VARCHAR(10) DEFAULT 'ðŸ“¦',
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

INSERT INTO ingredients (id, nama, harga_per_unit, satuan) 
VALUES ('d1000000-0000-0000-0000-000000000015', 'Kemasan Paper Box', 1200, 'pcs')
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_recipes (product_id, ingredient_id, jumlah_per_produk) 
VALUES ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000015', 1.0000)
ON CONFLICT (product_id, ingredient_id) DO UPDATE SET jumlah_per_produk = EXCLUDED.jumlah_per_produk;

-- Recalculate HPP
SELECT recalculate_all_hpp();

-- ============================================
-- ANS - HPP Professional Upgrade
-- Jalankan di Supabase SQL Editor SETELAH schema.sql
-- ============================================

-- ============================================
-- NEW TABLE: hpp_cost_config
-- Menyimpan semua komponen biaya non-bahan baku
-- Satu baris = konfigurasi biaya per bulan
-- ============================================
CREATE TABLE IF NOT EXISTS hpp_cost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Volume Produksi & Penjualan per Bulan
  jumlah_produksi_per_bulan INTEGER NOT NULL DEFAULT 10000,
  jumlah_terjual_per_bulan INTEGER NOT NULL DEFAULT 9000,
  
  -- 1. BIAYA TENAGA KERJA LANGSUNG (per bulan)
  gaji_produksi_per_bulan DECIMAL(14,2) DEFAULT 0,         -- Total gaji pekerja produksi
  jumlah_pekerja_produksi INTEGER DEFAULT 5,                -- Jumlah pekerja produksi
  
  -- 2. BIAYA OVERHEAD OPERASIONAL (per bulan)
  biaya_listrik DECIMAL(14,2) DEFAULT 0,
  biaya_gas_bahan_bakar DECIMAL(14,2) DEFAULT 0,
  biaya_sewa_tempat DECIMAL(14,2) DEFAULT 0,
  biaya_perawatan_mesin DECIMAL(14,2) DEFAULT 0,
  biaya_distribusi DECIMAL(14,2) DEFAULT 0,
  biaya_overhead_lain DECIMAL(14,2) DEFAULT 0,
  
  -- 3. BIAYA PEMASARAN & PENJUALAN (per bulan)
  biaya_promosi DECIMAL(14,2) DEFAULT 0,
  biaya_iklan DECIMAL(14,2) DEFAULT 0,
  biaya_pemasaran_lain DECIMAL(14,2) DEFAULT 0,
  
  -- 4. BIAYA ADMINISTRASI & UMUM (per bulan)
  gaji_admin DECIMAL(14,2) DEFAULT 0,
  biaya_peralatan_kantor DECIMAL(14,2) DEFAULT 0,
  biaya_komunikasi DECIMAL(14,2) DEFAULT 0,
  biaya_admin_lain DECIMAL(14,2) DEFAULT 0,
  
  -- 5. PAJAK & IURAN
  persentase_pajak DECIMAL(5,2) DEFAULT 0,                  -- PPN (misal: 11%)
  biaya_iuran_lain DECIMAL(14,2) DEFAULT 0,                 -- BPJS, izin, dll per bulan
  
  -- Metadata
  catatan TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trigger updated_at
CREATE TRIGGER tr_hpp_cost_config_updated_at 
  BEFORE UPDATE ON hpp_cost_config 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS
ALTER TABLE hpp_cost_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hpp_config_select" ON hpp_cost_config FOR SELECT USING (true);
CREATE POLICY "hpp_config_modify" ON hpp_cost_config FOR ALL USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- ============================================
-- SEED: Default hpp_cost_config
-- (Estimasi biaya bulanan untuk usaha fried chicken)
-- ============================================
INSERT INTO hpp_cost_config (
  jumlah_produksi_per_bulan,
  jumlah_terjual_per_bulan,
  gaji_produksi_per_bulan, jumlah_pekerja_produksi,
  biaya_listrik, biaya_gas_bahan_bakar, biaya_sewa_tempat,
  biaya_perawatan_mesin, biaya_distribusi, biaya_overhead_lain,
  biaya_promosi, biaya_iklan, biaya_pemasaran_lain,
  gaji_admin, biaya_peralatan_kantor, biaya_komunikasi, biaya_admin_lain,
  persentase_pajak, biaya_iuran_lain,
  catatan
) VALUES (
  15000,    -- 15.000 produk/bulan
  13500,    -- 13.500 terjual/bulan (90%)
  25000000, -- Gaji produksi total Rp 25 juta/bulan
  8,        -- 8 pekerja produksi
  5000000,  -- Listrik Rp 5 juta
  3000000,  -- Gas/BBM Rp 3 juta
  8000000,  -- Sewa tempat Rp 8 juta
  1500000,  -- Perawatan Rp 1.5 juta
  4000000,  -- Distribusi Rp 4 juta
  1000000,  -- Overhead lain Rp 1 juta
  2000000,  -- Promosi Rp 2 juta
  1500000,  -- Iklan Rp 1.5 juta
  500000,   -- Pemasaran lain Rp 500rb
  15000000, -- Gaji admin Rp 15 juta
  500000,   -- Peralatan kantor Rp 500rb
  300000,   -- Komunikasi Rp 300rb
  200000,   -- Admin lain Rp 200rb
  11.00,    -- PPN 11%
  2000000,  -- BPJS, izin, dll Rp 2 juta
  'Konfigurasi default - sesuaikan dengan biaya aktual'
);

-- ============================================
-- UPDATE FUNCTION: calculate_hpp profesional
-- ============================================
DROP FUNCTION IF EXISTS calculate_hpp(UUID);

CREATE OR REPLACE FUNCTION calculate_hpp_full(p_product_id UUID)
RETURNS TABLE (
  biaya_bahan_baku DECIMAL,
  biaya_tenaga_kerja DECIMAL,
  biaya_overhead DECIMAL,
  biaya_pemasaran DECIMAL,
  biaya_administrasi DECIMAL,
  biaya_pajak DECIMAL,
  hpp_total DECIMAL
) AS $$
DECLARE
  v_bahan DECIMAL := 0;
  v_tenaga_kerja DECIMAL := 0;
  v_overhead DECIMAL := 0;
  v_pemasaran DECIMAL := 0;
  v_administrasi DECIMAL := 0;
  v_subtotal DECIMAL := 0;
  v_pajak DECIMAL := 0;
  v_total DECIMAL := 0;
  v_config RECORD;
BEGIN
  -- 1. Biaya Bahan Baku Langsung (dari resep)
  SELECT COALESCE(SUM(i.harga_per_unit * pr.jumlah_per_produk), 0)
  INTO v_bahan
  FROM product_recipes pr
  JOIN ingredients i ON i.id = pr.ingredient_id
  WHERE pr.product_id = p_product_id;
  
  -- Ambil konfigurasi biaya
  SELECT * INTO v_config FROM hpp_cost_config LIMIT 1;
  
  IF v_config IS NOT NULL AND v_config.jumlah_produksi_per_bulan > 0 THEN
    -- 2. Biaya Tenaga Kerja Langsung per produk
    v_tenaga_kerja := (v_config.gaji_produksi_per_bulan) 
                      / v_config.jumlah_produksi_per_bulan;
    
    -- 3. Biaya Overhead Operasional per produk
    v_overhead := (
      COALESCE(v_config.biaya_listrik, 0) + 
      COALESCE(v_config.biaya_gas_bahan_bakar, 0) + 
      COALESCE(v_config.biaya_sewa_tempat, 0) + 
      COALESCE(v_config.biaya_perawatan_mesin, 0) + 
      COALESCE(v_config.biaya_distribusi, 0) + 
      COALESCE(v_config.biaya_overhead_lain, 0)
    ) / v_config.jumlah_produksi_per_bulan;
    
    -- 4. Biaya Pemasaran per produk (dibagi jumlah terjual)
    IF v_config.jumlah_terjual_per_bulan > 0 THEN
      v_pemasaran := (
        COALESCE(v_config.biaya_promosi, 0) + 
        COALESCE(v_config.biaya_iklan, 0) + 
        COALESCE(v_config.biaya_pemasaran_lain, 0)
      ) / v_config.jumlah_terjual_per_bulan;
    END IF;
    
    -- 5. Biaya Administrasi per produk (dibagi jumlah terjual)
    IF v_config.jumlah_terjual_per_bulan > 0 THEN
      v_administrasi := (
        COALESCE(v_config.gaji_admin, 0) + 
        COALESCE(v_config.biaya_peralatan_kantor, 0) + 
        COALESCE(v_config.biaya_komunikasi, 0) + 
        COALESCE(v_config.biaya_admin_lain, 0) +
        COALESCE(v_config.biaya_iuran_lain, 0)
      ) / v_config.jumlah_terjual_per_bulan;
    END IF;
    
    -- Subtotal sebelum pajak
    v_subtotal := v_bahan + v_tenaga_kerja + v_overhead + v_pemasaran + v_administrasi;
    
    -- 6. Biaya Pajak (PPN dll)
    v_pajak := v_subtotal * COALESCE(v_config.persentase_pajak, 0) / 100;
  END IF;
  
  v_total := v_bahan + v_tenaga_kerja + v_overhead + v_pemasaran + v_administrasi + v_pajak;
  
  RETURN QUERY SELECT
    ROUND(v_bahan, 2),
    ROUND(v_tenaga_kerja, 2),
    ROUND(v_overhead, 2),
    ROUND(v_pemasaran, 2),
    ROUND(v_administrasi, 2),
    ROUND(v_pajak, 2),
    ROUND(v_total, 2);
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- UPDATE: recalculate_product_hpp using full HPP
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_product_hpp(p_product_id UUID)
RETURNS void AS $$
DECLARE
  v_result RECORD;
  v_margin DECIMAL(5,2);
  v_harga_jual DECIMAL(12,2);
BEGIN
  SELECT * INTO v_result FROM calculate_hpp_full(p_product_id);
  SELECT margin_persen INTO v_margin FROM products WHERE id = p_product_id;
  v_harga_jual := v_result.hpp_total * (1 + COALESCE(v_margin, 0) / 100);
  
  UPDATE products 
  SET hpp = v_result.hpp_total, 
      harga_jual = v_harga_jual,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;
-- ============================================
-- ANS - Tambah hpp_saat_ini di sale_items
-- ============================================

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS hpp_saat_ini DECIMAL(12,2) DEFAULT 0;
-- ============================================
-- ANS - Database Functions
-- ============================================

-- ============================================
-- 1. CALCULATE HPP for a product
-- ============================================
CREATE OR REPLACE FUNCTION calculate_hpp(p_product_id UUID)
RETURNS DECIMAL AS $$
  SELECT COALESCE(SUM(i.harga_per_unit * pr.jumlah_per_produk), 0)
  FROM product_recipes pr
  JOIN ingredients i ON i.id = pr.ingredient_id
  WHERE pr.product_id = p_product_id;
$$ LANGUAGE SQL;

-- ============================================
-- 2. RECALCULATE HPP & harga_jual for a product
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_product_hpp(p_product_id UUID)
RETURNS void AS $$
DECLARE
  v_hpp DECIMAL(12,2);
  v_harga_jual DECIMAL(12,2);
  v_margin DECIMAL(5,2);
BEGIN
  v_hpp := calculate_hpp(p_product_id);
  
  -- Ambil harga jual saat ini
  SELECT COALESCE(harga_jual, 0) INTO v_harga_jual FROM products WHERE id = p_product_id;
  
  -- Hitung margin baru berdasarkan HPP, harga jual tetap
  IF v_hpp > 0 THEN
      v_margin := ((v_harga_jual - v_hpp) / v_hpp) * 100;
  ELSE
      v_margin := 0;
  END IF;

  UPDATE products 
  SET hpp = v_hpp, 
      margin_persen = v_margin,
      updated_at = NOW()
  WHERE id = p_product_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 3. RECALCULATE ALL products HPP
-- ============================================
CREATE OR REPLACE FUNCTION recalculate_all_hpp()
RETURNS void AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM products WHERE is_active = true LOOP
    PERFORM recalculate_product_hpp(r.id);
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 4. GENERATE REQUEST CODE (REQ-YYYYMMDD-NNN)
-- ============================================
CREATE OR REPLACE FUNCTION generate_request_code()
RETURNS TRIGGER AS $$
DECLARE
  v_date TEXT;
  v_count INTEGER;
  v_code TEXT;
BEGIN
  v_date := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count 
  FROM stock_requests 
  WHERE request_code LIKE 'REQ-' || v_date || '%';
  v_code := 'REQ-' || v_date || '-' || LPAD(v_count::TEXT, 3, '0');
  NEW.request_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_request_code
  BEFORE INSERT ON stock_requests
  FOR EACH ROW
  WHEN (NEW.request_code IS NULL)
  EXECUTE FUNCTION generate_request_code();

-- ============================================
-- 5. GENERATE SALE CODE (SLE-YYYYMMDD-NNN)
-- ============================================
CREATE OR REPLACE FUNCTION generate_sale_code()
RETURNS TRIGGER AS $$
DECLARE
  v_date TEXT;
  v_count INTEGER;
  v_code TEXT;
BEGIN
  v_date := TO_CHAR(NOW(), 'YYYYMMDD');
  SELECT COUNT(*) + 1 INTO v_count 
  FROM sales 
  WHERE sale_code LIKE 'SLE-' || v_date || '%';
  v_code := 'SLE-' || v_date || '-' || LPAD(v_count::TEXT, 3, '0');
  NEW.sale_code := v_code;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_generate_sale_code
  BEFORE INSERT ON sales
  FOR EACH ROW
  WHEN (NEW.sale_code IS NULL)
  EXECUTE FUNCTION generate_sale_code();

-- ============================================
-- 6. AUTO-UPDATE STOCK on request approval
-- ============================================
CREATE OR REPLACE FUNCTION on_request_approved()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status = 'pending' THEN
    -- Reduce warehouse stock
    UPDATE warehouse_stock ws
    SET stok_tersedia = ws.stok_tersedia - COALESCE(sri.jumlah_approved, sri.jumlah)
    FROM stock_request_items sri
    WHERE sri.request_id = NEW.id
      AND ws.product_id = sri.product_id;

    -- Increase outlet stock (upsert)
    INSERT INTO outlet_stock (outlet_id, product_id, stok_tersedia)
    SELECT NEW.outlet_id, sri.product_id, COALESCE(sri.jumlah_approved, sri.jumlah)
    FROM stock_request_items sri
    WHERE sri.request_id = NEW.id
    ON CONFLICT (outlet_id, product_id) 
    DO UPDATE SET 
      stok_tersedia = outlet_stock.stok_tersedia + EXCLUDED.stok_tersedia,
      updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_on_request_approved
  AFTER UPDATE ON stock_requests
  FOR EACH ROW
  EXECUTE FUNCTION on_request_approved();

-- ============================================
-- 7. AUTO-UPDATE SALE TOTAL
-- ============================================
CREATE OR REPLACE FUNCTION update_sale_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE sales
  SET total_amount = (
    SELECT COALESCE(SUM(subtotal), 0) 
    FROM sale_items 
    WHERE sale_id = COALESCE(NEW.sale_id, OLD.sale_id)
  )
  WHERE id = COALESCE(NEW.sale_id, OLD.sale_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_update_sale_total
  AFTER INSERT OR UPDATE OR DELETE ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION update_sale_total();

-- ============================================
-- 8. AUTO-REDUCE OUTLET STOCK on sale
-- ============================================
CREATE OR REPLACE FUNCTION on_sale_item_inserted()
RETURNS TRIGGER AS $$
DECLARE
  v_outlet_id UUID;
BEGIN
  SELECT outlet_id INTO v_outlet_id FROM sales WHERE id = NEW.sale_id;
  
  UPDATE outlet_stock
  SET stok_tersedia = stok_tersedia - NEW.jumlah,
      updated_at = NOW()
  WHERE outlet_id = v_outlet_id AND product_id = NEW.product_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_on_sale_item_inserted
  AFTER INSERT ON sale_items
  FOR EACH ROW
  EXECUTE FUNCTION on_sale_item_inserted();

-- ============================================
-- 9. TRIGGER: Recalculate HPP when recipe changes
-- ============================================
CREATE OR REPLACE FUNCTION on_recipe_change()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM recalculate_product_hpp(COALESCE(NEW.product_id, OLD.product_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_on_recipe_change
  AFTER INSERT OR UPDATE OR DELETE ON product_recipes
  FOR EACH ROW
  EXECUTE FUNCTION on_recipe_change();

-- ============================================
-- 10. TRIGGER: Recalculate HPP when ingredient price changes
-- ============================================
CREATE OR REPLACE FUNCTION on_ingredient_price_change()
RETURNS TRIGGER AS $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT product_id FROM product_recipes WHERE ingredient_id = NEW.id LOOP
    PERFORM recalculate_product_hpp(r.product_id);
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_on_ingredient_price_change
  AFTER UPDATE OF harga_per_unit ON ingredients
  FOR EACH ROW
  EXECUTE FUNCTION on_ingredient_price_change();
-- ============================================
-- ANS - Row Level Security Policies
-- Run AFTER schema.sql and functions.sql
-- ============================================

-- Enable RLS on all tables
ALTER TABLE outlets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE outlet_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

-- Helper function to get current user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- Helper function to get current user's outlet_id
CREATE OR REPLACE FUNCTION get_user_outlet_id()
RETURNS UUID AS $$
  SELECT outlet_id FROM profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER;

-- ============================================
-- PROFILES
-- ============================================
CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT WITH CHECK (
  get_user_role() = 'admin' OR id = auth.uid()
);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE USING (
  get_user_role() = 'admin' OR id = auth.uid()
);

-- ============================================
-- OUTLETS
-- ============================================
CREATE POLICY "outlets_select" ON outlets FOR SELECT USING (true);
CREATE POLICY "outlets_insert" ON outlets FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "outlets_update" ON outlets FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "outlets_delete" ON outlets FOR DELETE USING (get_user_role() = 'admin');

-- ============================================
-- CATEGORIES
-- ============================================
CREATE POLICY "categories_select" ON categories FOR SELECT USING (true);
CREATE POLICY "categories_modify" ON categories FOR ALL USING (get_user_role() = 'admin');

-- ============================================
-- PRODUCTS
-- ============================================
CREATE POLICY "products_select" ON products FOR SELECT USING (true);
CREATE POLICY "products_insert" ON products FOR INSERT WITH CHECK (get_user_role() = 'admin');
CREATE POLICY "products_update" ON products FOR UPDATE USING (get_user_role() = 'admin');
CREATE POLICY "products_delete" ON products FOR DELETE USING (get_user_role() = 'admin');

-- ============================================
-- INGREDIENTS
-- ============================================
CREATE POLICY "ingredients_select" ON ingredients FOR SELECT USING (true);
CREATE POLICY "ingredients_modify" ON ingredients FOR ALL USING (get_user_role() = 'admin');

-- ============================================
-- PRODUCT_RECIPES
-- ============================================
CREATE POLICY "recipes_select" ON product_recipes FOR SELECT USING (true);
CREATE POLICY "recipes_modify" ON product_recipes FOR ALL USING (get_user_role() = 'admin');

-- ============================================
-- WAREHOUSE_STOCK
-- ============================================
CREATE POLICY "warehouse_stock_select" ON warehouse_stock FOR SELECT USING (true);
CREATE POLICY "warehouse_stock_modify" ON warehouse_stock FOR ALL USING (get_user_role() = 'admin');

-- ============================================
-- OUTLET_STOCK
-- ============================================
CREATE POLICY "outlet_stock_select" ON outlet_stock FOR SELECT USING (
  get_user_role() IN ('admin', 'management') OR outlet_id = get_user_outlet_id()
);
CREATE POLICY "outlet_stock_modify" ON outlet_stock FOR ALL USING (get_user_role() = 'admin');

-- ============================================
-- STOCK_REQUESTS
-- ============================================
CREATE POLICY "requests_select" ON stock_requests FOR SELECT USING (
  get_user_role() IN ('admin', 'management') OR outlet_id = get_user_outlet_id()
);
CREATE POLICY "requests_insert" ON stock_requests FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'outlet')
);
CREATE POLICY "requests_update" ON stock_requests FOR UPDATE USING (
  get_user_role() = 'admin' OR (get_user_role() = 'outlet' AND outlet_id = get_user_outlet_id() AND status = 'pending')
);

-- ============================================
-- STOCK_REQUEST_ITEMS
-- ============================================
CREATE POLICY "request_items_select" ON stock_request_items FOR SELECT USING (true);
CREATE POLICY "request_items_insert" ON stock_request_items FOR INSERT WITH CHECK (true);
CREATE POLICY "request_items_update" ON stock_request_items FOR UPDATE USING (get_user_role() = 'admin');

-- ============================================
-- SALES
-- ============================================
CREATE POLICY "sales_select" ON sales FOR SELECT USING (
  get_user_role() IN ('admin', 'management') OR outlet_id = get_user_outlet_id()
);
CREATE POLICY "sales_insert" ON sales FOR INSERT WITH CHECK (
  get_user_role() IN ('admin', 'outlet')
);
CREATE POLICY "sales_update" ON sales FOR UPDATE USING (
  get_user_role() = 'admin' OR (get_user_role() = 'outlet' AND outlet_id = get_user_outlet_id())
);

-- ============================================
-- SALE_ITEMS
-- ============================================
CREATE POLICY "sale_items_select" ON sale_items FOR SELECT USING (true);
CREATE POLICY "sale_items_insert" ON sale_items FOR INSERT WITH CHECK (true);
CREATE POLICY "sale_items_update" ON sale_items FOR UPDATE USING (get_user_role() = 'admin');

-- ============================================
-- AUTO-CREATE PROFILE on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, nama, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nama', NEW.email),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'outlet')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
