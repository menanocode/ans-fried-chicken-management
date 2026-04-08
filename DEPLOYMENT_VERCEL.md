# Deployment Production ke Vercel

Dokumen ini menyiapkan kebutuhan minimum agar aplikasi siap dipublikasikan.

## 1. Persyaratan

- Akun Vercel
- Akun Supabase (project production)
- Repository GitHub (public/private)
- Node.js 20+ (untuk build lokal opsional)

## 2. Environment Variable (wajib)

Set dua variabel berikut di Vercel Project Settings > Environment Variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Contoh tersedia di `frontend/.env.example`.

## 3. Setup database production

Jalankan SQL ke project Supabase production dengan urutan:

1. `database/schema.sql`
2. `database/functions.sql`
3. `database/rls_policies.sql`
4. `database/seed.sql`

Opsional untuk konfigurasi HPP lanjutan:

1. `database/hpp_upgrade.sql`
2. `database/hpp_config_trigger.sql`

## 4. Konfigurasi Vercel di repo

Repo ini sudah disiapkan dengan `vercel.json` di root:

- `installCommand`: `npm --prefix frontend install`
- `buildCommand`: `npm --prefix frontend run build`
- `outputDirectory`: `frontend/dist`

Ini memungkinkan deploy langsung dari root repo tanpa perlu set Root Directory manual.

## 5. Langkah deploy

1. Import repository ke Vercel.
2. Pastikan framework terdeteksi sebagai `Vite`.
3. Isi environment variable production.
4. Klik Deploy.

## 6. Catatan operasional

- Routing aplikasi memakai hash (`#`), jadi aman untuk static hosting.
- Jangan commit file `frontend/.env` ke repository.
- Untuk keamanan production, ganti kredensial default admin dari README.
