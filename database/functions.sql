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
  v_result RECORD;
  v_harga_jual DECIMAL(12,2);
  v_margin DECIMAL(5,2);
BEGIN
  SELECT * INTO v_result FROM calculate_hpp_full(p_product_id);
  
  -- Ambil harga jual saat ini
  SELECT COALESCE(harga_jual, 0) INTO v_harga_jual FROM products WHERE id = p_product_id;
  
  -- Hitung margin baru berdasarkan HPP, harga jual tetap
  IF v_result.hpp_total > 0 THEN
      v_margin := ((v_harga_jual - v_result.hpp_total) / v_result.hpp_total) * 100;
  ELSE
      v_margin := 0;
  END IF;

  UPDATE products 
  SET hpp = v_result.hpp_total, 
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
-- 9. DELETE SALE + RESTORE STOCK (RPC)
-- ============================================
CREATE OR REPLACE FUNCTION delete_sale_with_stock_restore(p_sale_id UUID)
RETURNS sales
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale sales%ROWTYPE;
  v_role TEXT;
  v_user_outlet UUID;
BEGIN
  SELECT * INTO v_sale
  FROM sales
  WHERE id = p_sale_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaksi tidak ditemukan';
  END IF;

  SELECT role, outlet_id
  INTO v_role, v_user_outlet
  FROM profiles
  WHERE id = auth.uid();

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Akses ditolak';
  END IF;

  IF v_role = 'outlet' AND v_sale.outlet_id IS DISTINCT FROM v_user_outlet THEN
    RAISE EXCEPTION 'Akses ditolak untuk outlet lain';
  END IF;

  IF v_role NOT IN ('admin', 'outlet') THEN
    RAISE EXCEPTION 'Role tidak diizinkan menghapus transaksi';
  END IF;

  INSERT INTO outlet_stock (outlet_id, product_id, stok_tersedia, updated_at)
  SELECT
    v_sale.outlet_id,
    si.product_id,
    SUM(si.jumlah),
    NOW()
  FROM sale_items si
  WHERE si.sale_id = p_sale_id
  GROUP BY si.product_id
  ON CONFLICT (outlet_id, product_id)
  DO UPDATE SET
    stok_tersedia = outlet_stock.stok_tersedia + EXCLUDED.stok_tersedia,
    updated_at = NOW();

  DELETE FROM sales WHERE id = p_sale_id;

  RETURN v_sale;
END;
$$;

-- ============================================
-- 10. TRIGGER: Recalculate HPP when recipe changes
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
-- 11. TRIGGER: Recalculate HPP when ingredient price changes
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
