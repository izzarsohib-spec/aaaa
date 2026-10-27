# Adzkia Collection - Pembukuan & Inventaris Toko

Aplikasi internal toko seragam satpam: produk + modal (HPP), stok, kasir, dan laba kotor harian (WIB).

**Stack (versi mayor terpasang):** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, Drizzle ORM 0.45 + `postgres` 3, Zod 4, jose 6, bcryptjs 3, Vitest 5. Satu package manager: **npm** (`package-lock.json` di-commit).
Catatan Next 16: `middleware.ts` bernama **`src/proxy.ts`**; `params` route bersifat Promise.

## Setup lokal

```bash
npm install
cp .env.example .env.local        # isi DATABASE_URL, JWT_SECRET, SEED_ADMIN_PASSWORD
npm run db:migrate                # terapkan migrasi di ./drizzle
npm run db:seed                   # buat akun ADMIN (aman diulang)
npm run dev                       # http://localhost:3000
```

Tidak punya Postgres lokal? `node scripts/local-pg.mjs` menyalakan Postgres sungguhan (embedded) di port 54329 dengan database `adzkia` dan `adzkia_test`.

## Database di Supabase

1. Buat project Supabase, ambil **Connection string > Transaction pooler** (port 6543) sebagai `DATABASE_URL`.
2. Jalankan `npm run db:migrate` dan `npm run db:seed` dengan `DATABASE_URL` itu.
3. Pooler mode transaction dikenali otomatis (prepared statement dimatikan), pool maks 10 koneksi.
4. Backup: nyalakan Point-in-Time Recovery di Supabase dan catat retensinya di sini: _(isi setelah diaktifkan)_. Lakukan satu kali uji pulih ke database kosong sebelum dipakai harian.

## Perintah

| Perintah | Fungsi |
|---|---|
| `npm run build` | build produksi |
| `npx tsc --noEmit` | cek tipe |
| `npm test` | unit test (+ integration test bila `TEST_DATABASE_URL` diisi) |
| `npm run db:generate` | buat migrasi baru dari `src/db/schema.ts` (jangan sunting migrasi lama) |
| `npm run seed:test` | isi database uji (`TEST_DATABASE_URL`) dengan data uji PRD, sekaligus reset |
| `node scripts/smoke.mjs` | smoke test HTTP sesuai PRD terhadap server yang sedang jalan |

Integration test memakai database **terpisah**: `TEST_DATABASE_URL=postgresql://.../adzkia_test npm test`.

## Deploy

Aplikasi ini memakai route handler Node.js, jadi **tidak bisa** di GitHub Pages (hanya hosting statis). Pola yang dipakai: kode di **GitHub**, di-deploy ke **Vercel** dari repo itu, database di **Supabase**.

Urutan deploy: build -> **jalankan migrasi** -> restart/aktifkan versi baru -> smoke test. Set env di Vercel: `DATABASE_URL`, `JWT_SECRET` (acak, min. 32 karakter), `APP_URL` (URL produksi). Hanya ada dua lingkungan: lokal dan produksi.

## Keamanan & konvensi

- Sesi: cookie `HttpOnly`, `Secure` (produksi), `SameSite=Lax`; request yang mengubah data wajib header `x-csrf-token`.
- RBAC: ADMIN penuh; STAFF tidak menerima `cost_price`, `gross_profit`, maupun `total_profit` (dipotong di server, bukan hanya disembunyikan di UI).
- Rate limit di aplikasi (in-memory per instance): baca 120/menit/IP, tulis 20/menit/pengguna, login 5 gagal/15 menit per akun dan per IP dengan jeda membesar. Bila memakai lebih dari satu instance, ganti store-nya.
- Semua respons: `{ success, message, data? }`; error membawa `code` dan `errors` (400).
- Uang = integer Rupiah. Waktu disimpan `timestamptz` (UTC), hari dihitung WIB.
- Reset password dilakukan pemilik lewat database (bukan fitur aplikasi).
- `GET /health` memeriksa proses dan koneksi database. `SENTRY_DSN` belum terhubung ke SDK (variabel disiapkan di `.env.example`).

## Belum dikerjakan / catatan

- Error tracker (Sentry) belum dipasang; ekspor/impor dan job latar belum ada (tidak diminta di MVP).
- Cetak nota memakai dialog cetak browser (keputusan PRD, printer thermal ditunda).
- `TEST-PLAN.md` yang dirujuk PRD tidak ada di folder ini; seed uji memakai bagian "Data uji" PRD.

## Toko online

- Publik (tanpa login): `/`, `/katalog`, `/produk?id=`, `/keranjang`, `/checkout`, `/pembayaran?no=`, `/pesanan`, `/panduan-ukuran`, `/grosir`, `/bantuan`, `/tentang`.
- API publik: `GET /api/shop/products`, `GET /api/shop/products/:id`, `POST /api/shop/orders`, `POST /api/shop/orders/lookup`, `POST /api/shop/orders/pay` (dibatasi 20 tulis/menit/IP). Harga dan ongkir selalu dihitung ulang di server; `cost_price` tidak pernah dikirim.
- Pelacakan pesanan butuh nomor pesanan DAN nomor WhatsApp. Nomor HP disimpan satu bentuk (`+62...`).
- Admin/kasir: menu "Pesanan Online" (`/orders`, `GET /api/orders`, `PATCH /api/orders/:id` dengan `action` confirm_payment, ship, complete, cancel). Batal hanya ADMIN.
- **Isi data toko asli** di `src/lib/shop.ts`: nomor WhatsApp, email, alamat, rekening bank. Nilainya sekarang PLACEHOLDER.
- Foto produk: isi `image_url` (alamat https) di form produk; kosong = ilustrasi bawaan. Unggah file belum ada (butuh storage).

## Demo statis (GitHub Pages)

`node scripts/build-demo.mjs` membuat `.demo-out/` (data contoh di localStorage, tanpa database), lalu dipublikasikan ke branch `gh-pages`. Alamat: https://izzarsohib-spec.github.io/aaaa/
