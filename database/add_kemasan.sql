
INSERT INTO ingredients (id, nama, harga_per_unit, satuan) 
VALUES ('d1000000-0000-0000-0000-000000000015', 'Kemasan Paper Box', 1200, 'pcs')
ON CONFLICT (id) DO NOTHING;

INSERT INTO product_recipes (product_id, ingredient_id, jumlah_per_produk) 
VALUES ('c1000000-0000-0000-0000-000000000001', 'd1000000-0000-0000-0000-000000000015', 1.0000)
ON CONFLICT (product_id, ingredient_id) DO UPDATE SET jumlah_per_produk = EXCLUDED.jumlah_per_produk;

-- Recalculate HPP
SELECT recalculate_all_hpp();

