import { z } from "zod";

const rupiah = (label: string) =>
  z
    .number({ error: label + " harus berupa angka" })
    .int(label + " harus bilangan bulat (Rupiah)")
    .min(0, label + " tidak boleh negatif")
    .max(2_000_000_000, label + " terlalu besar");

const qty = z
  .number({ error: "Kuantitas harus berupa angka" })
  .int("Kuantitas harus bilangan bulat")
  .min(1, "Kuantitas harus lebih dari 0")
  .max(1_000_000, "Kuantitas terlalu besar");

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(200),
  password: z.string().min(1, "Password wajib diisi").max(200),
});

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1, "SKU wajib diisi").max(50, "SKU maksimal 50 karakter"),
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(200),
  unit: z.string().trim().min(1, "Satuan wajib diisi").max(20).default("pcs"),
  cost_price: rupiah("Harga modal"),
  selling_price: rupiah("Harga jual"),
  current_stock: z.number().int("Stok harus bilangan bulat").min(0, "Stok tidak boleh negatif").max(1_000_000).default(0),
});

export const productUpdateSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU wajib diisi").max(50),
    name: z.string().trim().min(1, "Nama produk wajib diisi").max(200),
    unit: z.string().trim().min(1).max(20),
    cost_price: rupiah("Harga modal"),
    selling_price: rupiah("Harga jual"),
  })
  .partial();

export const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid("Produk tidak valid"),
  type: z.enum(["IN", "OUT", "ADJUSTMENT"], { error: "Tipe penyesuaian tidak valid" }),
  quantity: qty,
  notes: z.string().trim().min(1, "Catatan alasan wajib diisi").max(500),
});

export const saleCreateSchema = z.object({
  payment_method: z.enum(["CASH", "TRANSFER"], { error: "Metode bayar tidak valid" }),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(z.object({ product_id: z.string().uuid("Produk tidak valid"), quantity: qty }))
    .min(1, "Keranjang masih kosong")
    .max(200, "Maksimal 200 item per transaksi"),
});

export const userCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email("Email tidak valid").max(200),
  name: z.string().trim().min(1, "Nama wajib diisi").max(100),
  password: z.string().min(8, "Password minimal 8 karakter").max(200),
  role: z.enum(["ADMIN", "STAFF"]).default("STAFF"),
});

export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format from harus YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format to harus YYYY-MM-DD").optional(),
});
