-- ============================================
-- ANS - Tambah hpp_saat_ini di sale_items
-- ============================================

ALTER TABLE sale_items
ADD COLUMN IF NOT EXISTS hpp_saat_ini DECIMAL(12,2) DEFAULT 0;
