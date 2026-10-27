import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { z } from "zod";
import type { Role } from "@/lib/auth";
import {
  PRICE_BELOW_COST_MESSAGE,
  calculateSubtotal,
  jakartaDayRange,
  toJakartaDate,
} from "@/lib/calculations";
import { AppError, conflict, notFound } from "@/lib/errors";
import {
  assertLoginAllowed,
  clearLoginFailures,
  recordLoginFailure,
} from "@/lib/rate-limit";
import type {
  productCreateSchema,
  productUpdateSchema,
  saleCreateSchema,
  stockAdjustmentSchema,
  userCreateSchema,
} from "@/lib/validation";
import { db, productRepo, runInTransaction, saleRepo, stockRepo, userRepo } from "@/repositories";

type Product = NonNullable<Awaited<ReturnType<typeof productRepo.findActive>>>;

/* ------------------------------------------------------------------- auth */
// Hash palsu supaya waktu respons sama baik akun ada maupun tidak.
const DUMMY_HASH = bcrypt.hashSync("tidak-pernah-cocok", 12);

export const authService = {
  async login(email: string, password: string, ip: string) {
    assertLoginAllowed(ip, email);
    const user = await userRepo.findForLogin(db(), email);
    const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !valid) {
      recordLoginFailure(ip, email);
      throw new AppError(401, "INVALID_CREDENTIALS", "Email atau password salah");
    }
    clearLoginFailures(email);
    return { id: user.id, name: user.name, role: user.role as Role };
  },
};

/* ------------------------------------------------------------------ users */
export const userService = {
  async list(o: { limit: number; offset: number; search: string }) {
    const { items, total } = await userRepo.list(db(), o);
    return {
      total,
      items: items.map((u) => ({ id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.createdAt })),
    };
  },
  async create(input: z.infer<typeof userCreateSchema>) {
    const u = await userRepo.insert(db(), {
      email: input.email,
      name: input.name,
      role: input.role,
      passwordHash: await bcrypt.hash(input.password, 12),
    });
    return { id: u.id, email: u.email, name: u.name, role: u.role, created_at: u.createdAt };
  },
};

/* --------------------------------------------------------------- products */
/** Ubah baris DB ke payload snake_case; HPP disembunyikan untuk STAFF. */
export function toProductDto(p: Product, role: Role) {
  const base = {
    id: p.id,
    sku: p.sku,
    name: p.name,
    unit: p.unit,
    selling_price: p.sellingPrice,
    current_stock: p.currentStock,
  };
  return role === "ADMIN" ? { ...base, cost_price: p.costPrice } : base;
}

function priceError(): AppError {
  return new AppError(400, "PRICE_BELOW_COST", PRICE_BELOW_COST_MESSAGE, {
    selling_price: PRICE_BELOW_COST_MESSAGE,
  });
}

function skuError(): AppError {
  return new AppError(409, "SKU_ALREADY_EXISTS", "SKU sudah dipakai produk lain", {
    sku: "SKU sudah dipakai produk lain",
  });
}

export const productService = {
  async list(role: Role, o: Parameters<typeof productRepo.list>[1]) {
    const { items, total } = await productRepo.list(db(), o);
    return { items: items.map((p) => toProductDto(p, role)), total };
  },

  async create(input: z.infer<typeof productCreateSchema>, role: Role) {
    if (input.selling_price < input.cost_price) throw priceError();
    if (await productRepo.skuTaken(db(), input.sku)) throw skuError();
    const p = await productRepo.insert(db(), {
      sku: input.sku,
      name: input.name,
      unit: input.unit,
      costPrice: input.cost_price,
      sellingPrice: input.selling_price,
      currentStock: input.current_stock,
    });
    return toProductDto(p, role);
  },

  async update(id: string, input: z.infer<typeof productUpdateSchema>, role: Role) {
    return runInTransaction(async (tx) => {
      const current = await productRepo.lockActiveById(tx, id);
      if (!current) throw notFound("Produk tidak ditemukan");
      const cost = input.cost_price ?? current.costPrice;
      const price = input.selling_price ?? current.sellingPrice;
      if (price < cost) throw priceError();
      if (input.sku && (await productRepo.skuTaken(tx, input.sku, id))) throw skuError();
      // HPP historis aman: transaksi lama memakai snapshot di sale_items.
      const updated = await productRepo.update(tx, id, {
        ...(input.sku !== undefined && { sku: input.sku }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.unit !== undefined && { unit: input.unit }),
        costPrice: cost,
        sellingPrice: price,
      });
      return toProductDto(updated!, role);
    });
  },

  /** Selalu soft-delete; baris fisik tidak pernah dihapus (riwayat transaksi tetap utuh). */
  async remove(id: string) {
    if (!(await productRepo.softDelete(db(), id))) throw notFound("Produk tidak ditemukan");
  },
};

/* ------------------------------------------------------------------ stock */
export const stockService = {
  async adjust(input: z.infer<typeof stockAdjustmentSchema>, userId: string) {
    return runInTransaction(async (tx) => {
      const product = await productRepo.lockActiveById(tx, input.product_id);
      if (!product) throw notFound("Produk tidak ditemukan");

      let next: number;
      let notes = input.notes;
      if (input.type === "IN") {
        next = product.currentStock + input.quantity;
      } else if (input.type === "OUT") {
        if (input.quantity > product.currentStock) {
          throw conflict("INSUFFICIENT_STOCK", "Jumlah penyesuaian keluar melebihi stok yang tersedia saat ini");
        }
        next = product.currentStock - input.quantity;
      } else {
        // ADJUSTMENT = koreksi opname: quantity adalah stok fisik hasil hitung.
        next = input.quantity;
        notes = input.notes + " (stok sistem " + product.currentStock + " menjadi " + next + ")";
      }
      await productRepo.setStock(tx, product.id, next);
      const row = await stockRepo.insert(tx, {
        productId: product.id,
        userId,
        type: input.type,
        quantity: input.quantity,
        notes,
      });
      return {
        id: row.id,
        product_id: row.productId,
        user_id: row.userId,
        type: row.type,
        quantity: row.quantity,
        notes: row.notes,
        current_stock: next,
      };
    });
  },
  async list(o: { limit: number; offset: number; productId?: string }) {
    return stockRepo.list(db(), o);
  },
};

/* ------------------------------------------------------------------ sales */
type SaleRow = Awaited<ReturnType<typeof saleRepo.insertSale>>;

function toSaleDto(s: SaleRow) {
  return {
    id: s.id,
    invoice_number: s.invoiceNumber,
    user_id: s.userId,
    total_amount: s.totalAmount,
    status: s.status,
    payment_method: s.paymentMethod,
    notes: s.notes,
    created_at: s.createdAt,
  };
}

function invoiceNumber(now: Date): string {
  const d = toJakartaDate(now).replaceAll("-", "");
  return "INV-" + d + "-" + randomBytes(3).toString("hex").toUpperCase();
}

export const saleService = {
  async create(input: z.infer<typeof saleCreateSchema>, userId: string) {
    // Gabungkan baris produk yang sama (klik ganda di keranjang).
    const wanted = new Map<string, number>();
    for (const it of input.items) wanted.set(it.product_id, (wanted.get(it.product_id) ?? 0) + it.quantity);
    const ids = [...wanted.keys()];

    return runInTransaction(async (tx) => {
      const locked = await productRepo.lockByIds(tx, ids);
      const byId = new Map(locked.map((p) => [p.id, p]));

      // Validasi semua dulu supaya pesan error spesifik per SKU.
      for (const id of ids) {
        const p = byId.get(id);
        if (!p || p.deletedAt) throw notFound("Produk tidak ditemukan atau sudah dihapus");
        const qty = wanted.get(id)!;
        if (qty > p.currentStock) {
          throw conflict(
            "STOCK_INSUFFICIENT",
            "Stok tidak mencukupi untuk " + p.sku + ". Sisa stok: " + p.currentStock,
          );
        }
      }

      const lines = ids.map((id) => {
        const p = byId.get(id)!;
        const quantity = wanted.get(id)!;
        return {
          p,
          quantity,
          subtotal: calculateSubtotal(p.sellingPrice, quantity),
        };
      });
      const total = lines.reduce((a, l) => a + l.subtotal, 0);

      const sale = await saleRepo.insertSale(tx, {
        invoiceNumber: invoiceNumber(new Date()),
        userId,
        totalAmount: total,
        status: "COMPLETED",
        paymentMethod: input.payment_method,
        notes: input.notes || null,
      });
      await saleRepo.insertItems(
        tx,
        lines.map((l) => ({
          saleId: sale.id,
          productId: l.p.id,
          quantity: l.quantity,
          costPriceAtSale: l.p.costPrice,
          sellingPriceAtSale: l.p.sellingPrice,
          subtotal: l.subtotal,
        })),
      );
      for (const l of lines) await productRepo.setStock(tx, l.p.id, l.p.currentStock - l.quantity);
      return toSaleDto(sale);
    });
  },

  async cancel(id: string) {
    return runInTransaction(async (tx) => {
      const sale = await saleRepo.lockById(tx, id);
      if (!sale) throw notFound("Transaksi tidak ditemukan");
      if (sale.status === "CANCELLED") {
        throw new AppError(409, "ALREADY_CANCELLED", "Transaksi sudah dibatalkan sebelumnya");
      }
      const items = await saleRepo.itemsOf(tx, id);
      const locked = await productRepo.lockByIds(
        tx,
        items.map((i) => i.product_id),
      );
      const byId = new Map(locked.map((p) => [p.id, p]));
      for (const it of items) {
        const p = byId.get(it.product_id)!;
        await productRepo.setStock(tx, p.id, p.currentStock + it.quantity);
      }
      return toSaleDto(await saleRepo.setStatus(tx, id, "CANCELLED"));
    });
  },

  async list(role: Role, o: { limit: number; offset: number; from?: string; to?: string }) {
    const from = o.from ? jakartaDayRange(o.from).start : undefined;
    const toExclusive = o.to ? jakartaDayRange(o.to).end : undefined;
    const { items, total } = await saleRepo.list(db(), { limit: o.limit, offset: o.offset, from, toExclusive });
    return {
      total,
      items: items.map((r) => ({
        ...toSaleDto(r.sale),
        cashier_name: r.cashier,
        item_count: r.itemCount,
        ...(role === "ADMIN" ? { gross_profit: Number(r.profit) } : {}),
      })),
    };
  },

  async detail(id: string, role: Role) {
    const row = await saleRepo.findWithUser(db(), id);
    if (!row) throw notFound("Transaksi tidak ditemukan");
    const items = await saleRepo.itemsOf(db(), id);
    return {
      ...toSaleDto(row.sale),
      cashier_name: row.cashier,
      items: items.map((i) => {
        const { cost_price_at_sale, ...rest } = i;
        return role === "ADMIN" ? { ...rest, cost_price_at_sale } : rest;
      }),
    };
  },

  async dailySummary(role: Role, date = toJakartaDate(new Date())) {
    const { start, end } = jakartaDayRange(date);
    const agg = await saleRepo.dailyAggregate(db(), start, end);
    return {
      date,
      total_sales_count: agg.count,
      total_revenue: agg.revenue,
      total_profit: role === "ADMIN" ? agg.profit : 0,
    };
  },
};

