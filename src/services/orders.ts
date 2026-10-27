import { randomBytes } from "node:crypto";
import { z } from "zod";
import { calculateSubtotal, toJakartaDate } from "@/lib/calculations";
import { AppError, conflict, notFound } from "@/lib/errors";
import { SHIPPING, normalizePhone, type OrderStatus } from "@/lib/shop";
import { db, productRepo, runInTransaction, saleRepo } from "@/repositories";
import { orderRepo, shopRepo } from "@/repositories/orders";

type OrderRow = NonNullable<Awaited<ReturnType<typeof orderRepo.findById>>>;

export const orderCreateSchema = z.object({
  customer_name: z.string().trim().min(2, "Nama penerima wajib diisi").max(100),
  phone: z
    .string()
    .trim()
    .max(30, "Nomor WhatsApp terlalu panjang")
    .refine((v) => normalizePhone(v) !== null, "Nomor WhatsApp tidak valid"),
  address: z.string().trim().min(5, "Alamat lengkap wajib diisi").max(300),
  city: z.string().trim().min(2, "Kota wajib diisi").max(100),
  postal_code: z.string().trim().max(10).optional(),
  shipping_method: z.enum(SHIPPING.map((s) => s.id) as [string, ...string[]], { error: "Pilih metode pengiriman" }),
  notes: z.string().trim().max(500).optional(),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid("Produk tidak valid"),
        quantity: z.number().int("Jumlah harus bilangan bulat").min(1, "Jumlah minimal 1").max(1000),
      }),
    )
    .min(1, "Keranjang masih kosong")
    .max(50, "Maksimal 50 jenis barang per pesanan"),
});

export const orderLookupSchema = z.object({
  order_number: z.string().trim().min(5).max(40),
  phone: z.string().trim().min(5).max(30),
});

export const orderActionSchema = z.object({
  action: z.enum(["confirm_payment", "ship", "complete", "cancel"]),
  tracking_number: z.string().trim().max(60).optional(),
});

function orderNumber(now: Date): string {
  return "ORD-" + toJakartaDate(now).replaceAll("-", "") + "-" + randomBytes(3).toString("hex").toUpperCase();
}

async function toDetail(o: OrderRow, includeAdmin: boolean) {
  const [items, events] = await Promise.all([orderRepo.itemsOf(db(), o.id), orderRepo.eventsOf(db(), o.id)]);
  return {
    id: o.id,
    order_number: o.orderNumber,
    status: o.status,
    customer_name: o.customerName,
    address: o.address,
    city: o.city,
    postal_code: o.postalCode,
    shipping_method: o.shippingMethod,
    shipping_cost: o.shippingCost,
    subtotal: o.subtotal,
    total_amount: o.totalAmount,
    notes: o.notes,
    tracking_number: o.trackingNumber,
    created_at: o.createdAt,
    ...(includeAdmin ? { phone: o.phone, sale_id: o.saleId } : {}),
    items: items.map((i) => ({
      id: i.id,
      product_id: i.productId,
      sku: i.sku,
      name: i.name,
      quantity: i.quantity,
      unit_price: i.unitPrice,
      subtotal: i.subtotal,
    })),
    events: events.map((e) => ({ status: e.status, created_at: e.createdAt })),
  };
}

const NEXT: Record<string, { from: OrderStatus[]; to: OrderStatus }> = {
  confirm_payment: { from: ["MENUNGGU_PEMBAYARAN", "MENUNGGU_KONFIRMASI"], to: "DIPROSES" },
  ship: { from: ["DIPROSES"], to: "DIKIRIM" },
  complete: { from: ["DIKIRIM"], to: "SELESAI" },
};

function badTransition(): AppError {
  return conflict("INVALID_TRANSITION", "Status pesanan tidak memungkinkan tindakan ini");
}

export const shopService = {
  async listProducts(o: { limit: number; offset: number; search: string; category?: string; sort: string; inStockOnly: boolean }) {
    return shopRepo.list(db(), o);
  },
  async getProduct(id: string) {
    const p = await shopRepo.find(db(), id);
    if (!p) throw notFound("Produk tidak ditemukan");
    return p;
  },
};

export const orderService = {
  /** Pesanan pelanggan: stok langsung dipesan (dipotong) agar tidak terjual ganda. */
  async create(input: z.infer<typeof orderCreateSchema>) {
    const phone = normalizePhone(input.phone);
    if (!phone) {
      throw new AppError(400, "VALIDATION_ERROR", "Input tidak valid", { phone: "Nomor WhatsApp tidak valid" });
    }
    const ship = SHIPPING.find((s) => s.id === input.shipping_method)!;
    const wanted = new Map<string, number>();
    for (const it of input.items) wanted.set(it.product_id, (wanted.get(it.product_id) ?? 0) + it.quantity);
    const ids = [...wanted.keys()];

    const created = await runInTransaction(async (tx) => {
      const locked = await productRepo.lockByIds(tx, ids);
      const byId = new Map(locked.map((p) => [p.id, p]));
      for (const id of ids) {
        const p = byId.get(id);
        if (!p || p.deletedAt) throw notFound("Ada produk yang sudah tidak tersedia");
        const qty = wanted.get(id)!;
        if (qty > p.currentStock) {
          throw conflict("STOCK_INSUFFICIENT", "Stok tidak mencukupi untuk " + p.name + ". Sisa stok: " + p.currentStock);
        }
      }
      const lines = ids.map((id) => {
        const p = byId.get(id)!;
        const quantity = wanted.get(id)!;
        return { p, quantity, subtotal: calculateSubtotal(p.sellingPrice, quantity) };
      });
      const subtotal = lines.reduce((a, l) => a + l.subtotal, 0);
      const order = await orderRepo.insert(tx, {
        orderNumber: orderNumber(new Date()),
        customerName: input.customer_name,
        phone,
        address: input.address,
        city: input.city,
        postalCode: input.postal_code || null,
        shippingMethod: ship.label,
        shippingCost: ship.cost,
        subtotal,
        totalAmount: subtotal + ship.cost,
        notes: input.notes || null,
      });
      await orderRepo.insertItems(
        tx,
        lines.map((l) => ({
          orderId: order.id,
          productId: l.p.id,
          sku: l.p.sku,
          name: l.p.name,
          quantity: l.quantity,
          unitPrice: l.p.sellingPrice,
          unitCost: l.p.costPrice,
          subtotal: l.subtotal,
        })),
      );
      for (const l of lines) await productRepo.setStock(tx, l.p.id, l.p.currentStock - l.quantity);
      await orderRepo.addEvent(tx, order.id, "MENUNGGU_PEMBAYARAN");
      return order;
    });
    return toDetail(created, false);
  },

  /** Cari pesanan: nomor pesanan DAN nomor HP harus cocok (salah satunya tidak bisa ditebak sendiri). */
  async lookup(orderNumberRaw: string, phoneRaw: string) {
    const o = await orderRepo.findByNumber(db(), orderNumberRaw.toUpperCase());
    if (!o || o.phone !== normalizePhone(phoneRaw)) throw notFound("Pesanan tidak ditemukan. Periksa nomor pesanan dan nomor WhatsApp.");
    return toDetail(o, false);
  },

  async claimPaid(orderNumberRaw: string, phoneRaw: string) {
    const phone = normalizePhone(phoneRaw);
    const updated = await runInTransaction(async (tx) => {
      const o = await orderRepo.lockByNumber(tx, orderNumberRaw.toUpperCase());
      if (!o || o.phone !== phone) throw notFound("Pesanan tidak ditemukan.");
      if (o.status !== "MENUNGGU_PEMBAYARAN") throw badTransition();
      const u = await orderRepo.update(tx, o.id, { status: "MENUNGGU_KONFIRMASI" });
      await orderRepo.addEvent(tx, o.id, "MENUNGGU_KONFIRMASI");
      return u;
    });
    return toDetail(updated, false);
  },

  async list(o: { limit: number; offset: number; status?: OrderStatus }) {
    const { items, total } = await orderRepo.list(db(), o);
    return {
      total,
      items: items.map((x) => ({
        id: x.id,
        order_number: x.orderNumber,
        status: x.status,
        customer_name: x.customerName,
        phone: x.phone,
        city: x.city,
        total_amount: x.totalAmount,
        shipping_method: x.shippingMethod,
        tracking_number: x.trackingNumber,
        created_at: x.createdAt,
      })),
    };
  },

  async detail(id: string) {
    const o = await orderRepo.findById(db(), id);
    if (!o) throw notFound("Pesanan tidak ditemukan");
    return toDetail(o, true);
  },

  async act(id: string, input: z.infer<typeof orderActionSchema>, userId: string, isAdmin: boolean) {
    const updated = await runInTransaction(async (tx) => {
      const o = await orderRepo.lockById(tx, id);
      if (!o) throw notFound("Pesanan tidak ditemukan");

      if (input.action === "cancel") {
        if (!isAdmin) throw new AppError(403, "FORBIDDEN", "Hanya pemilik yang dapat membatalkan pesanan");
        if (o.status === "SELESAI" || o.status === "DIBATALKAN") throw badTransition();
        const items = await orderRepo.itemsOf(tx, o.id);
        const locked = await productRepo.lockByIds(tx, items.map((i) => i.productId));
        const byId = new Map(locked.map((p) => [p.id, p]));
        for (const it of items) {
          const p = byId.get(it.productId)!;
          await productRepo.setStock(tx, p.id, p.currentStock + it.quantity);
        }
        if (o.saleId) await saleRepo.setStatus(tx, o.saleId, "CANCELLED");
        await orderRepo.addEvent(tx, o.id, "DIBATALKAN");
        return orderRepo.update(tx, o.id, { status: "DIBATALKAN" });
      }

      const rule = NEXT[input.action];
      if (!rule.from.includes(o.status)) throw badTransition();
      let saleId = o.saleId;
      if (input.action === "confirm_payment") {
        // Pembayaran terkonfirmasi = penjualan tercatat (omset barang; ongkir tidak dihitung). Stok sudah dipotong saat pesan.
        const items = await orderRepo.itemsOf(tx, o.id);
        const sale = await saleRepo.insertSale(tx, {
          invoiceNumber: o.orderNumber,
          userId,
          totalAmount: o.subtotal,
          status: "COMPLETED",
          paymentMethod: "TRANSFER",
          notes: "Pesanan online " + o.orderNumber,
        });
        await saleRepo.insertItems(
          tx,
          items.map((i) => ({
            saleId: sale.id,
            productId: i.productId,
            quantity: i.quantity,
            costPriceAtSale: i.unitCost,
            sellingPriceAtSale: i.unitPrice,
            subtotal: i.subtotal,
          })),
        );
        saleId = sale.id;
      }
      await orderRepo.addEvent(tx, o.id, rule.to);
      return orderRepo.update(tx, o.id, {
        status: rule.to,
        saleId,
        ...(input.action === "ship" && input.tracking_number ? { trackingNumber: input.tracking_number } : {}),
      });
    });
    return toDetail(updated, true);
  },
};
