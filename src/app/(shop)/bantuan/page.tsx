const FAQ = [
  ["Bagaimana cara memesan produk?", "Pilih produk, tambahkan ke keranjang, isi alamat di halaman checkout, lalu transfer sesuai total tagihan. Pesanan diproses setelah pembayaran dikonfirmasi."],
  ["Metode pembayaran apa yang tersedia?", "Saat ini transfer bank. Kirim bukti transfer lewat WhatsApp lalu tekan tombol \"Saya sudah membayar\"."],
  ["Berapa lama proses pengiriman?", "Pesanan dikemas setelah pembayaran dikonfirmasi. Estimasi sampai 1-3 hari kerja tergantung ekspedisi yang dipilih."],
  ["Apakah bisa custom logo atau bordir?", "Bisa. Gunakan halaman Grosir & Custom Logo atau hubungi kami lewat WhatsApp."],
  ["Bagaimana jika ukuran tidak sesuai?", "Cek Panduan Ukuran sebelum memesan. Hubungi kami di WhatsApp untuk pertanyaan penukaran barang."],
  ["Bagaimana melacak pesanan saya?", "Buka menu Lacak Pesanan, lalu masukkan nomor pesanan dan nomor WhatsApp yang dipakai saat memesan."],
];

export default function HelpPage() {
  return (
    <div className="grid max-w-2xl gap-5">
      <h1 className="text-2xl font-bold tracking-tight">Pusat Bantuan</h1>
      <div className="grid gap-2">
        {FAQ.map(([q, a]) => (
          <details key={q} className="rounded-lg border border-border bg-surface px-4 py-3">
            <summary className="cursor-pointer font-medium">{q}</summary>
            <p className="mt-2 text-sm text-muted">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
