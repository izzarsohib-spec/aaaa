/** Rumus bersama (layar kasir, API, laporan). Semua nilai uang = Rupiah bulat. */

export const PRICE_BELOW_COST_MESSAGE =
  "Harga jual tidak boleh lebih kecil dari harga modal (HPP)";

export class PriceBelowCostError extends Error {
  readonly code = "PRICE_BELOW_COST";
  constructor() {
    super(PRICE_BELOW_COST_MESSAGE);
    this.name = "PriceBelowCostError";
  }
}

/** Bulatkan ke Rupiah terdekat (half-up, simetris untuk negatif) dan buang sisa error float. */
export function roundRupiah(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError("Nilai uang harus berupa angka terhingga");
  const cleaned = Number(Math.abs(value).toFixed(6));
  const rounded = Math.sign(value) * Math.round(cleaned);
  return rounded === 0 ? 0 : rounded;
}

/** Tolak bila harga jual < modal. Harga sama (margin 0) diperbolehkan. */
export function validateProductPrice(modal: number, hargaJual: number): void {
  if (modal < 0) throw new RangeError("Harga modal (HPP) tidak boleh negatif");
  if (roundRupiah(hargaJual) < roundRupiah(modal)) throw new PriceBelowCostError();
}

function assertQty(qty: number): void {
  if (!Number.isInteger(qty) || qty <= 0) {
    throw new RangeError("Kuantitas harus bilangan bulat lebih dari 0");
  }
}

/** Laba = (hargaJual - modal) * qty. Harga dibulatkan ke Rupiah per unit sebelum dikalikan. */
export function calculateProfit(modal: number, hargaJual: number, qty: number): number {
  assertQty(qty);
  const profit = (roundRupiah(hargaJual) - roundRupiah(modal)) * qty;
  return profit === 0 ? 0 : profit;
}

/** Subtotal = selling_price_at_sale * quantity. */
export function calculateSubtotal(hargaJual: number, qty: number): number {
  assertQty(qty);
  return roundRupiah(hargaJual) * qty;
}

export interface SaleLine {
  status: "COMPLETED" | "CANCELLED";
  createdAt: Date;
  items: { quantity: number; costPriceAtSale: number; sellingPriceAtSale: number }[];
}

export interface DailySummary {
  total_sales_count: number;
  total_revenue: number;
  total_profit: number;
}

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Tanggal kalender (YYYY-MM-DD) di Asia/Jakarta untuk sebuah instan waktu. */
export function toJakartaDate(instant: Date): string {
  return new Date(instant.getTime() + WIB_OFFSET_MS).toISOString().slice(0, 10);
}

/** Rentang [start, end) UTC untuk satu hari WIB (00:00:00 s.d. 23:59:59.999). */
export function jakartaDayRange(date: string): { start: Date; end: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new RangeError("Format tanggal harus YYYY-MM-DD");
  const start = new Date(`${date}T00:00:00+07:00`);
  if (Number.isNaN(start.getTime())) throw new RangeError("Tanggal tidak valid");
  return { start, end: new Date(start.getTime() + DAY_MS) };
}

/** Versi murni dari agregasi harian; query SQL di repository harus sepakat dengan fungsi ini. */
export function summarizeSales(lines: SaleLine[], date: string): DailySummary {
  const { start, end } = jakartaDayRange(date);
  let count = 0;
  let revenue = 0;
  let profit = 0;
  for (const sale of lines) {
    if (sale.status !== "COMPLETED") continue;
    if (sale.createdAt < start || sale.createdAt >= end) continue;
    count += 1;
    for (const it of sale.items) {
      revenue += calculateSubtotal(it.sellingPriceAtSale, it.quantity);
      profit += calculateProfit(it.costPriceAtSale, it.sellingPriceAtSale, it.quantity);
    }
  }
  return { total_sales_count: count, total_revenue: revenue, total_profit: profit };
}

export function formatRupiah(n: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(n);
}
