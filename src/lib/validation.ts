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

/* Foto produk: tautan https atau data URL gambar hasil unggah/kamera (sudah diperkecil di browser). */
const imageField = z.union([
  z.literal(""),
  z.string().trim().url("URL gambar tidak valid").max(500),
  z.string().regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, "Format gambar tidak valid").max(600_000, "Foto terlalu besar"),
]);

export const productCreateSchema = z.object({
  sku: z.string().trim().min(1, "SKU wajib diisi").max(50, "SKU maksimal 50 karakter"),
  name: z.string().trim().min(1, "Nama produk wajib diisi").max(200),
  unit: z.string().trim().min(1, "Satuan wajib diisi").max(20).default("pcs"),
  cost_price: rupiah("Harga modal"),
  selling_price: rupiah("Harga jual"),
  category: z.string().trim().min(1).max(50).default("Lainnya"),
  description: z.string().trim().max(1000).optional(),
  image_url: imageField.optional(),
  current_stock: z.number().int("Stok harus bilangan bulat").min(0, "Stok tidak boleh negatif").max(1_000_000).default(0),
});

export const productUpdateSchema = z
  .object({
    sku: z.string().trim().min(1, "SKU wajib diisi").max(50),
    name: z.string().trim().min(1, "Nama produk wajib diisi").max(200),
    unit: z.string().trim().min(1).max(20),
    category: z.string().trim().min(1).max(50),
    description: z.string().trim().max(1000),
    image_url: imageField,
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

/* Integrasi sistem pengadaan (Ray Mitra): kiriman barang datang dan tagihan. */
const isoDate = (label: string) => z.string().regex(/^\d{4}-\d{2}-\d{2}$/, label + " harus berformat YYYY-MM-DD");

export const pengadaanEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("goods_received"),
    receipt_no: z.string().trim().min(1, "Nomor penerimaan wajib diisi").max(60),
    po_number: z.string().trim().max(60).optional(),
    received_date: isoDate("Tanggal diterima"),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(z.object({ sku: z.string().trim().min(1, "SKU wajib diisi").max(50), quantity: qty }))
      .min(1, "Minimal satu barang")
      .max(300, "Maksimal 300 baris barang"),
  }),
  z.object({
    type: z.literal("invoice"),
    invoice_number: z.string().trim().min(1, "Nomor tagihan wajib diisi").max(60),
    issued_date: isoDate("Tanggal tagihan"),
    due_date: isoDate("Jatuh tempo"),
    total_amount: rupiah("Total tagihan"),
    status: z.enum(["MENDATANG", "DIBATALKAN"]).default("MENDATANG"),
    notes: z.string().trim().max(500).optional(),
    items: z
      .array(
        z.object({
          description: z.string().trim().min(1).max(200),
          quantity: qty,
          unit_price: rupiah("Harga satuan"),
        }),
      )
      .max(300)
      .default([]),
  }),
]);
export type PengadaanEvent = z.infer<typeof pengadaanEventSchema>;

export const invoiceActionSchema = z.object({
  status: z.enum(["LUNAS", "MENDATANG"], { error: "Status tidak valid" }),
});

export const dateRangeSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format from harus YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format to harus YYYY-MM-DD").optional(),
});
