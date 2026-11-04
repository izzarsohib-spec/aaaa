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

## 2026-11-04 - Unggah foto produk
- Form produk: kolom URL gambar diganti pemilih foto (tarik-lepas, pilih dari komputer/galeri, atau kamera langsung). Foto diperkecil di browser (maks 800px, JPEG) lalu disimpan sebagai data URL di kolom `image_url` (tanpa migrasi).
- Validasi `image_url` menerima tautan https atau data URL gambar (maks 600 KB).

## 2026-11-04 - Grosir & Custom Logo jadi dua sub halaman
- `/grosir` (Grosir) dan `/grosir/custom-logo` (Custom Logo) dengan tab berdampingan di atas formulir; menu "Grosir & Custom Logo" tetap menyala di kedua halaman.
- Grosir: produk, jumlah & ukuran, tanggal dibutuhkan (opsional), catatan. Custom Logo: produk, jumlah, jenis (bordir/sablon), posisi logo (centang), teks, catatan. Keduanya terkirim lewat WhatsApp.
- Komponen bersama `order-request-form.tsx` untuk kolom perusahaan, PIC, dan WhatsApp.

## 2026-11-04 - Grosir per ukuran
- Formulir Grosir: produk dan jumlah teks bebas diganti tiga kelompok (Baju S-XXL, Celana S-XXL, Sepatu 38-45) dengan kolom qty di samping tiap ukuran. Pesan WhatsApp merangkum ukuran yang terisi beserta total per kelompok; minimal satu ukuran wajib diisi.

## 2026-11-04 - Grosir: pilih ukuran lewat dropdown cari
- Ukuran baju (S-XXL, L4-L7), celana (28-48 kelipatan 2), dan sepatu (37-45) dipilih lewat kolom cari + dropdown (`size-combobox.tsx`), qty di sisi kanan. Tombol "+ Tambah ukuran" untuk beberapa ukuran; ukuran yang sudah dipilih tidak muncul lagi di baris lain; tombol × menghapus baris.

## 2026-11-04 - Grosir: pilih jenis item
- Formulir Grosir dimulai dengan memilih jenis item (Seragam / Sepatu / Aksesoris, boleh lebih dari satu). Seragam: ukuran baju dan celana masing-masing dengan qty. Sepatu: jenis sepatu + ukuran + qty. Aksesoris: jenis aksesoris + qty. Pesan WhatsApp dikelompokkan per jenis item.
- Daftar jenis sepatu dan aksesoris di `grosir/page.tsx` (SHOE_TYPES, ACCESSORIES) masih contoh; sesuaikan dengan katalog.
