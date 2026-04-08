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
