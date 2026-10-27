# Changelog

## 2026-10-27 - Rilis awal (T1-T6)
- T1: vitest + `src/lib/calculations.ts` (laba, validasi harga, pembulatan, zona WIB) dengan 18 unit test.
- T2: skema Drizzle (users, products, stock_adjustments, sales, sale_items), migrasi awal, seed admin.
- T3: login JWT cookie httpOnly, CSRF double-submit, rate limit login, `src/proxy.ts` (pengganti middleware di Next 16).
- T4: CRUD produk (soft-delete, SKU unik case-insensitive), penyesuaian stok, HPP disembunyikan untuk STAFF.
- T5: POST /api/sales dengan transaksi + SELECT FOR UPDATE, snapshot harga/modal, UI kasir anti-double-submit.
- T6: ringkasan harian WIB, pembatalan atomik, dashboard, riwayat, nota cetak, manajemen akun staf.
