# Changelog

## 2026-10-27 - Rilis awal (T1-T6)
- T1: vitest + `src/lib/calculations.ts` (laba, validasi harga, pembulatan, zona WIB) dengan 18 unit test.
- T2: skema Drizzle (users, products, stock_adjustments, sales, sale_items), migrasi awal, seed admin.
- T3: login JWT cookie httpOnly, CSRF double-submit, rate limit login, `src/proxy.ts` (pengganti middleware di Next 16).
- T4: CRUD produk (soft-delete, SKU unik case-insensitive), penyesuaian stok, HPP disembunyikan untuk STAFF.
- T5: POST /api/sales dengan transaksi + SELECT FOR UPDATE, snapshot harga/modal, UI kasir anti-double-submit.
- T6: ringkasan harian WIB, pembatalan atomik, dashboard, riwayat, nota cetak, manajemen akun staf.

## 2026-10-27 - Toko online + tema baru
- Tema navy + emas untuk dashboard dan toko online.
- Etalase publik: beranda, katalog (kategori, urut, cari), detail produk, keranjang, checkout, pembayaran transfer, lacak pesanan, panduan ukuran, grosir/custom logo (via WhatsApp), bantuan, tentang.
- Pesanan online: stok dipesan saat checkout, konfirmasi bayar membuat penjualan (ongkir tidak masuk omset), kirim/selesai, batal mengembalikan stok. Menu "Pesanan Online" di dashboard.
- Migrasi 0001: kolom kategori/deskripsi/gambar produk, tabel orders, order_items, order_events.
- Mode demo statis (NEXT_PUBLIC_DEMO=1) untuk GitHub Pages: `node scripts/build-demo.mjs`.
- Nota penjualan pindah ke `/sales/view?id=`.
