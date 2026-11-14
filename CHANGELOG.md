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

## 2026-11-04 - Grosir: jenis dari katalog
- Seragam: ada pilihan "Jenis seragam" (nama produk kategori Seragam di katalog) sebelum ukuran baju dan celana; wajib dipilih. Jenis sepatu (kategori Sepatu) dan jenis aksesoris (kategori Topi + Atribut) juga diambil dari katalog; bila katalog gagal dimuat atau kosong, dipakai daftar bawaan.

## 2026-11-04 - Grosir: tampilan pemesanan massal untuk customer
- Halaman Grosir dirancang ulang jadi 4 langkah (`bulk-order-form.tsx`): 1) pemesan perusahaan/instansi atau perorangan + kontak, 2) pilih barang dari katalog per tab Seragam/Sepatu/Aksesoris dengan pencarian (boleh banyak jenis), 3) kartu per barang berisi kotak qty per ukuran (baju S-L7, celana 28-48, sepatu 37-45; aksesoris cukup jumlah), 4) tanggal dibutuhkan + catatan.
- Panel "Ringkasan pesanan" di kanan (di bawah pada HP) menampilkan subtotal tiap barang dan total per kategori; pesan WhatsApp dikelompokkan per kategori dengan nomor urut.
- Komponen dropdown ukuran `size-combobox.tsx` dihapus (tidak dipakai lagi).

## 2026-11-04 - Grosir: PDF permintaan dan nomor tujuan
- Tombol kirim di Grosir kini membuat PDF di browser (`src/lib/bulk-pdf.ts`, jsPDF + autotable; kop, data pemesan, tabel per kategori, ringkasan, catatan, nomor halaman, baris tidak terpotong antar halaman), mengunduhnya, lalu membuka WhatsApp dengan ringkasan teks singkat. Panel hasil menyediakan "Buka WhatsApp lagi", "Unduh PDF lagi", dan "Bagikan PDF" (HP). WhatsApp tidak bisa menerima lampiran otomatis dari link, jadi customer melampirkan PDF sendiri.
- Nomor tujuan permintaan Grosir dan Custom Logo dipisah: `WHOLESALE_WHATSAPP` di `src/lib/shop.ts`, sementara nomor uji 6285703191053; ganti dengan nomor Mas Wahyu nanti. `STORE.whatsapp` (kontak umum toko) tidak berubah.
- Dependensi baru: jspdf, jspdf-autotable.

- Kategori Celana dan Paket Hemat dihapus dari beranda, menu, daftar kategori, dan data demo (produk contoh celana dan paket ikut dihapus). Tabel Celana di Panduan Ukuran tetap karena itu panduan ukuran.

- Banner beranda: empat gambar diganti Seragam PDH, Topi Pet Satpam, Sepatu PDH Doof, dan Rompi dengan keterangan; memakai foto produk katalog bila sudah diunggah. Data demo disesuaikan (nama produk, tambah Rompi Satpam).

- Banner beranda: keterangan teks di bawah gambar dihapus; kotak Topi memakai foto topi mana pun yang sudah diunggah bila nama tidak memuat "Pet".

- Foto rompi security dipasang (public/produk/rompi-security.jpg): jadi gambar kotak Rompi di banner beranda dan foto produk Rompi Satpam di data demo.

- Banner beranda: kotak Seragam diganti dua kotak, Seragam Safari dan Seragam PDH SUS, memakai foto produk katalog yang namanya memuat "safari" dan "sus".

- Beranda: kotak Topi dihapus dari banner (jadi empat gambar: Seragam Safari, Seragam PDH SUS, Sepatu, Rompi) dan baris gambar kategori di bawah banner dihapus.

## 2026-11-14 - Integrasi pengadaan, langkah 1 (sisi toko)
- Penerima kiriman dari sistem pengadaan: `POST /api/integrations/pengadaan`, ditandatangani HMAC-SHA256 atas `<timestamp>.<body>` (header `x-pengadaan-timestamp`, `x-pengadaan-signature`, toleransi 5 menit, rahasia `PENGADAAN_WEBHOOK_SECRET` min. 32 karakter; kosong = 503).
- Dua jenis kiriman: `goods_received` (menambah stok per SKU, tercatat sebagai mutasi IN oleh akun sistem "Integrasi Pengadaan", idempoten per `receipt_no`, SKU tak dikenal menolak seluruh kiriman) dan `invoice` (upsert per `invoice_number`, tagihan yang sudah lunas tidak ditimpa).
- Migrasi 0002: tabel `pengadaan_receipts` dan `pengadaan_invoices`.
- Halaman `/administrator` (hanya Pemilik): ringkasan tagihan akan datang, jatuh tempo terdekat, barang datang 30 hari, stok paling sedikit, tab Tagihan (tandai lunas) dan Barang datang. Data demo ikut tersedia di mode demo.
- Test: 5 unit test tanda tangan, 5 integration test (stok, idempotensi, SKU tak dikenal, upsert tagihan, lunas).

- Tagihan dari pengadaan boleh tanpa jatuh tempo (`due_date` opsional, migrasi 0003); tampil "Tanpa jatuh tempo", diurutkan paling akhir, tidak dihitung lewat tempo. Kolom daftar Barang datang dinamai "No. dokumen / PO" karena memuat nomor surat jalan atau faktur dari pengadaan. Kontrak diuji ujung ke ujung dengan pengirim pengadaan (inti `kirim-ke-toko`): stok bertambah, kiriman ulang tidak dobel, SKU tak dikenal ditolak, tagihan di-upsert dan bisa dibatalkan.
