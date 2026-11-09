/** Konfigurasi & helper toko online (dipakai server dan klien). */

export const STORE = {
  name: "Adzkia Collection",
  tagline: "Seragam Satpam Lengkap & Berkualitas",
  // GANTI dengan data asli toko sebelum dipakai pelanggan.
  whatsapp: "6285640668003",
  phone: "0856-4066-8003",
  email: "halo@adzkia.example",
  address: "", // isi alamat toko; kosong = tidak ditampilkan
  hours: "Senin - Sabtu: 08.00 - 17.00 WIB",
  bank: { name: "BCA", number: "123 456 7890", holder: "Adzkia Collection" },
} as const;

/**
 * Tujuan permintaan Grosir & Custom Logo (WhatsApp, format 62...).
 * Sementara memakai nomor uji; nanti ganti dengan nomor Mas Wahyu.
 */
export const WHOLESALE_WHATSAPP = "6285703191053";

export const SHIRT_SIZES = ["S", "M", "L", "XL", "XXL", "L4", "L5", "L6"] as const;
export const PANTS_SIZES = ["28", "30", "32", "34", "36", "38", "40", "42", "44", "46", "48"] as const;

/** Seragam wajib memilih ukuran baju dan celana. */
export const needsSize = (category: string) => category === "Seragam Satpam";
export interface SizeRow {
  size: string;
  qty: number;
}

/** Gabungkan ukuran yang sama, urut sesuai daftar ukuran. */
export function mergeRows(rows: SizeRow[], order: readonly string[]): SizeRow[] {
  const m = new Map<string, number>();
  for (const r of rows) if (r.size && r.qty > 0) m.set(r.size, (m.get(r.size) ?? 0) + r.qty);
  return [...m].map(([size, qty]) => ({ size, qty })).sort((a, b) => order.indexOf(a.size) - order.indexOf(b.size));
}

export const sumRows = (rows: SizeRow[]) => rows.reduce((a, r) => a + (r.size && r.qty > 0 ? r.qty : 0), 0);

/** Contoh: "Baju L×3, XL×1 | Celana 30×2, 32×2". */
export function sizeLabel(shirts: SizeRow[], pants: SizeRow[]) {
  const f = (rows: SizeRow[]) => rows.map((r) => r.size + "×" + r.qty).join(", ");
  return "Baju " + f(shirts) + " | Celana " + f(pants);
}

export const CATEGORIES = ["Seragam Satpam", "Sepatu", "Topi", "Atribut", "Lainnya"] as const;

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
