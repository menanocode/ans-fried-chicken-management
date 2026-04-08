-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama character varying NOT NULL,
  deskripsi text,
  icon character varying DEFAULT '📦'::character varying,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT categories_pkey PRIMARY KEY (id)
);
CREATE TABLE public.hpp_cost_config (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  jumlah_produksi_per_bulan integer NOT NULL DEFAULT 10000,
  jumlah_terjual_per_bulan integer NOT NULL DEFAULT 9000,
  gaji_produksi_per_bulan numeric DEFAULT 0,
  jumlah_pekerja_produksi integer DEFAULT 5,
  biaya_listrik numeric DEFAULT 0,
  biaya_gas_bahan_bakar numeric DEFAULT 0,
  biaya_sewa_tempat numeric DEFAULT 0,
  biaya_perawatan_mesin numeric DEFAULT 0,
  biaya_distribusi numeric DEFAULT 0,
  biaya_overhead_lain numeric DEFAULT 0,
  biaya_promosi numeric DEFAULT 0,
  biaya_iklan numeric DEFAULT 0,
  biaya_pemasaran_lain numeric DEFAULT 0,
  gaji_admin numeric DEFAULT 0,
  biaya_peralatan_kantor numeric DEFAULT 0,
  biaya_komunikasi numeric DEFAULT 0,
  biaya_admin_lain numeric DEFAULT 0,
  persentase_pajak numeric DEFAULT 0,
  biaya_iuran_lain numeric DEFAULT 0,
  catatan text,
  updated_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT hpp_cost_config_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ingredients (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama character varying NOT NULL,
  harga_per_unit numeric NOT NULL DEFAULT 0,
  satuan character varying NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT ingredients_pkey PRIMARY KEY (id)
);
CREATE TABLE public.outlet_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  outlet_id uuid,
  product_id uuid,
  stok_tersedia integer NOT NULL DEFAULT 0,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT outlet_stock_pkey PRIMARY KEY (id),
  CONSTRAINT outlet_stock_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES public.outlets(id),
  CONSTRAINT outlet_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.outlets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  nama character varying NOT NULL,
  alamat text,
  telepon character varying,
  status character varying DEFAULT 'active'::character varying CHECK (status::text = ANY (ARRAY['active'::character varying, 'inactive'::character varying]::text[])),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT outlets_pkey PRIMARY KEY (id)
);
CREATE TABLE public.product_recipes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid,
  ingredient_id uuid,
  jumlah_per_produk numeric NOT NULL DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT product_recipes_pkey PRIMARY KEY (id),
  CONSTRAINT product_recipes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id),
  CONSTRAINT product_recipes_ingredient_id_fkey FOREIGN KEY (ingredient_id) REFERENCES public.ingredients(id)
);
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  category_id uuid,
  nama character varying NOT NULL,
  satuan character varying NOT NULL DEFAULT 'pcs'::character varying,
  hpp numeric DEFAULT 0,
  margin_persen numeric DEFAULT 0,
  harga_jual numeric DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT products_pkey PRIMARY KEY (id),
  CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.profiles (
  id uuid NOT NULL,
  nama character varying NOT NULL,
  email character varying,
  role character varying NOT NULL CHECK (role::text = ANY (ARRAY['admin'::character varying, 'outlet'::character varying, 'management'::character varying]::text[])),
  outlet_id uuid,
  avatar_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id),
  CONSTRAINT profiles_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES public.outlets(id)
);
CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_id uuid,
  product_id uuid,
  jumlah integer NOT NULL DEFAULT 0,
  harga_jual numeric NOT NULL DEFAULT 0,
  subtotal numeric NOT NULL DEFAULT 0,
  hpp_saat_ini numeric DEFAULT 0,
  CONSTRAINT sale_items_pkey PRIMARY KEY (id),
  CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id),
  CONSTRAINT sale_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  sale_code character varying UNIQUE,
  outlet_id uuid NOT NULL,
  recorded_by uuid,
  tanggal date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric DEFAULT 0,
  notes text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT sales_pkey PRIMARY KEY (id),
  CONSTRAINT sales_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES public.outlets(id),
  CONSTRAINT sales_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.stock_request_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_id uuid,
  product_id uuid,
  jumlah integer NOT NULL DEFAULT 0,
  jumlah_approved integer DEFAULT 0,
  CONSTRAINT stock_request_items_pkey PRIMARY KEY (id),
  CONSTRAINT stock_request_items_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.stock_requests(id),
  CONSTRAINT stock_request_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);
CREATE TABLE public.stock_requests (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  request_code character varying UNIQUE,
  outlet_id uuid NOT NULL,
  requested_by uuid,
  status character varying DEFAULT 'pending'::character varying CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying]::text[])),
  notes text,
  approved_by uuid,
  approved_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT stock_requests_pkey PRIMARY KEY (id),
  CONSTRAINT stock_requests_outlet_id_fkey FOREIGN KEY (outlet_id) REFERENCES public.outlets(id),
  CONSTRAINT stock_requests_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES public.profiles(id),
  CONSTRAINT stock_requests_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.profiles(id)
);
CREATE TABLE public.warehouse_stock (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  product_id uuid UNIQUE,
  stok_tersedia integer NOT NULL DEFAULT 0,
  stok_minimum integer NOT NULL DEFAULT 50,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT warehouse_stock_pkey PRIMARY KEY (id),
  CONSTRAINT warehouse_stock_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id)
);