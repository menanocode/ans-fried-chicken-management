# ANS Fried Chicken - Sistem Manajemen Penjualan

Sistem manajemen penjualan terintegrasi untuk bisnis fried chicken multi-outlet (21+ outlet).

## 🍗 Fitur

- **Dashboard** — Overview performa bisnis secara real-time
- **Manajemen Outlet** — CRUD 21+ outlet
- **Manajemen Produk** — Ayam goreng & minuman dengan kategori
- **Stok Gudang** — Monitoring stok real-time dengan alert level
- **Permintaan Stok** — Outlet request → Admin approval → auto-update stok
- **Penjualan** — Pencatatan penjualan harian per outlet
- **HPP & Harga** — Kalkulasi HPP otomatis + margin → harga jual
- **Laporan** — Chart penjualan per outlet, trend harian, analisis profit

## 🛠 Tech Stack

- **Frontend**: Vite + Vanilla JS + Chart.js
- **Database**: Supabase (PostgreSQL + Auth + Realtime + RLS)
- **Styling**: Vanilla CSS (Dark mode, Orange/Amber theme)

## 🚀 Setup

### 1. Buat Project Supabase

1. Buka [supabase.com](https://supabase.com) → Create New Project
2. Copy **Project URL** dan **anon/public key** dari Settings > API

### 2. Setup Database

Di Supabase Dashboard → SQL Editor, jalankan file SQL secara berurutan:

```
1. database/schema.sql      — Buat semua tabel
2. database/functions.sql    — Buat functions & triggers
3. database/rls_policies.sql — Setup Row Level Security
4. database/seed.sql         — Isi data awal (21 outlet, produk, bahan)
```

### 3. Buat User Admin

Di Supabase Dashboard → Authentication → Users → Add User:
- Email: `admin@ans.com`
- Password: `admin123` (ganti di production!)

Lalu di SQL Editor, update profilenya:
```sql
UPDATE profiles 
SET role = 'admin', nama = 'Admin Pusat' 
WHERE email = 'admin@ans.com';
```

Untuk user outlet:
```sql
-- Buat user di Authentication dulu, lalu:
UPDATE profiles 
SET role = 'outlet', 
    nama = 'Staff Outlet Bandung 1',
    outlet_id = 'b1000000-0000-0000-0000-000000000001'
WHERE email = 'outlet1@ans.com';
```

### 4. Setup Frontend

```bash
cd frontend
cp .env.example .env
# Edit .env dengan URL dan Key Supabase Anda
```

### 5. Jalankan

```bash
cd frontend
npm install
npm run dev
```

Buka http://localhost:5173

## 👥 User Roles

| Role | Akses |
|------|-------|
| **Admin** | Semua fitur (CRUD outlet, produk, stok, approve permintaan, HPP, laporan) |
| **Outlet** | Dashboard, permintaan stok, penjualan |
| **Management** | Dashboard, stok gudang, penjualan, HPP, laporan (read-only) |

## 📊 Database Schema

12 tabel terkoneksi:
- `profiles` — User profiles (extends Supabase Auth)
- `outlets` — Data 21 outlet
- `categories` — Kategori produk (Ayam, Minuman)
- `products` — Daftar produk
- `ingredients` — Bahan baku
- `product_recipes` — Resep per produk
- `warehouse_stock` — Stok gudang pusat
- `outlet_stock` — Stok per outlet
- `stock_requests` + `stock_request_items` — Permintaan stok
- `sales` + `sale_items` — Data penjualan

## 📁 Struktur Project

```
ANS/
├── database/
│   ├── schema.sql          # DDL tabel
│   ├── functions.sql       # Functions & triggers
│   ├── rls_policies.sql    # Row Level Security
│   └── seed.sql            # Data awal
├── frontend/
│   ├── index.html
│   ├── .env.example
│   └── src/
│       ├── main.js         # Router & app init
│       ├── config/
│       ├── styles/
│       ├── pages/
│       ├── components/
│       ├── services/
│       └── utils/
└── README.md
```

## Theme Switcher (Dark/Light)

Sekarang aplikasi mendukung penggantian tema gelap dan terang.

- Tombol tema tersedia di header aplikasi setelah login.
- Preferensi tema disimpan di browser (`localStorage`) dan otomatis dipakai saat aplikasi dibuka kembali.

## Deploy Production ke Vercel

File konfigurasi deploy sudah ditambahkan:

- `vercel.json` di root repo (build `frontend` -> output `frontend/dist`)
- `frontend/.env.example` untuk template environment variable
- `DEPLOYMENT_VERCEL.md` untuk panduan langkah production

Sebelum deploy, pastikan env berikut sudah diisi di Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
