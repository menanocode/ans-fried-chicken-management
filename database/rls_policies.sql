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
