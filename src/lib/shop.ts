/** Konfigurasi & helper toko online (dipakai server dan klien). */

export const STORE = {
  name: "Adzkia Collection",
  tagline: "Seragam Satpam Lengkap & Berkualitas",
  // GANTI dengan data asli toko sebelum dipakai pelanggan.
  whatsapp: "6281234567890",
  email: "halo@adzkia.example",
  address: "Alamat toko belum diisi",
  hours: "Senin - Sabtu: 08.00 - 17.00 WIB",
  bank: { name: "BCA", number: "123 456 7890", holder: "Adzkia Collection" },
} as const;

export const CATEGORIES = ["Seragam Satpam", "Celana", "Sepatu", "Topi", "Atribut", "Paket Hemat", "Lainnya"] as const;

/** Ongkir tetap (estimasi). Dihitung ulang di server, tidak dipercaya dari klien. */
export const SHIPPING = [
  { id: "JNE_REG", label: "JNE Reguler (2-3 hari)", cost: 25000 },
  { id: "JNT_EXPRESS", label: "J&T Express (2-3 hari)", cost: 23000 },
  { id: "SICEPAT", label: "SiCepat (1-2 hari)", cost: 21000 },
  { id: "AMBIL", label: "Ambil di toko", cost: 0 },
] as const;

export const ORDER_STATUS_LABEL = {
  MENUNGGU_PEMBAYARAN: "Menunggu pembayaran",
  MENUNGGU_KONFIRMASI: "Menunggu konfirmasi",
  DIPROSES: "Diproses",
  DIKIRIM: "Dikirim",
  SELESAI: "Selesai",
  DIBATALKAN: "Dibatalkan",
} as const;
export type OrderStatus = keyof typeof ORDER_STATUS_LABEL;

/** Simpan satu bentuk saja: +62xxxxxxxxxx. Mengembalikan null bila bukan nomor HP Indonesia yang wajar. */
export function normalizePhone(raw: string): string | null {
  let d = raw.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("0")) d = "62" + d.slice(1);
  else if (d.startsWith("8")) d = "62" + d;
  if (!/^628\d{7,12}$/.test(d)) return null;
  return "+" + d;
}

export function whatsappLink(message: string, number: string = STORE.whatsapp): string {
  return "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
}
