import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/**
 * Integration test terhadap PostgreSQL sungguhan. Hanya jalan bila TEST_DATABASE_URL diisi
 * (database TERPISAH, tabelnya dikosongkan di setiap test). Tidak pernah memakai DATABASE_URL.
 */
const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

describe.skipIf(!TEST_URL)("services + database", () => {
  let dbm: typeof import("@/db");
  let svc: typeof import("@/services");
  let adminId: string;

  beforeAll(async () => {
    dbm = await import("@/db");
    svc = await import("@/services");
    await migrate(dbm.getDb(), { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    const db = dbm.getDb();
    await db.execute(sql.raw("TRUNCATE sale_items, sales, stock_adjustments, products, users RESTART IDENTITY CASCADE"));
    const u = await svc.userService.create({ email: "a@x.id", name: "Admin", password: "password123", role: "ADMIN" });
    adminId = u.id;
  });

  afterAll(async () => {
    await dbm.closeDb();
  });

  const mk = (over: Partial<Parameters<typeof svc.productService.create>[0]> = {}) =>
    svc.productService.create(
      { sku: "SKU-01", name: "Baju", unit: "pcs", cost_price: 10000, selling_price: 15000, current_stock: 10, ...over },
      "ADMIN",
    );

  describe("produk", () => {
    it("menolak harga jual < modal dengan pesan PRD", async () => {
      await expect(mk({ sku: "SKU-ERR-01", cost_price: 50000, selling_price: 45000, current_stock: 5 })).rejects.toMatchObject({
        code: "PRICE_BELOW_COST",
        message: "Harga jual tidak boleh lebih kecil dari harga modal (HPP)",
      });
    });
    it("menolak SKU duplikat tanpa peduli huruf besar/kecil", async () => {
      await mk({ sku: "ABC-1" });
      await expect(mk({ sku: "abc-1" })).rejects.toMatchObject({ code: "SKU_ALREADY_EXISTS" });
    });
    it("constraint database menolak SKU duplikat walau lolos cek aplikasi", async () => {
      await mk({ sku: "ABC-1" });
      const { productRepo } = await import("@/repositories");
      await expect(
        productRepo.insert(dbm.getDb(), { sku: "abc-1", name: "x", costPrice: 1, sellingPrice: 2 }),
      ).rejects.toThrow();
    });
    it("soft-delete, SKU boleh dipakai ulang, riwayat transaksi tetap utuh", async () => {
      const p = await mk({ sku: "REUSE" });
      await svc.saleService.create({ payment_method: "CASH", items: [{ product_id: p.id, quantity: 1 }] }, adminId);
      await svc.productService.remove(p.id);
      const again = await mk({ sku: "REUSE" });
      expect(again.id).not.toBe(p.id);
      const { productRepo } = await import("@/repositories");
      expect(await productRepo.usedInSales(dbm.getDb(), p.id)).toBe(true); // baris fisik masih ada
      await expect(svc.productService.remove(p.id)).rejects.toMatchObject({ code: "NOT_FOUND" });
    });
    it("STAFF tidak melihat cost_price, ADMIN melihat", async () => {
      await mk();
      const staff = await svc.productService.list("STAFF", { limit: 20, offset: 0, search: "", sortBy: "name", sortOrder: "asc" });
      const admin = await svc.productService.list("ADMIN", { limit: 20, offset: 0, search: "", sortBy: "name", sortOrder: "asc" });
      expect(staff.items[0]).not.toHaveProperty("cost_price");
      expect(admin.items[0]).toHaveProperty("cost_price", 10000);
    });
    it("mengubah HPP tidak mengubah snapshot transaksi lama", async () => {
      const p = await mk();
      const sale = await svc.saleService.create({ payment_method: "CASH", items: [{ product_id: p.id, quantity: 2 }] }, adminId);
      await svc.productService.update(p.id, { cost_price: 12000, selling_price: 20000 }, "ADMIN");
      const detail = await svc.saleService.detail(sale.id, "ADMIN");
      expect(detail.items[0]).toMatchObject({ cost_price_at_sale: 10000, selling_price_at_sale: 15000 });
    });
  });

  describe("stok", () => {
    it("IN menambah stok seketika", async () => {
      const p = await mk();
      const r = await svc.stockService.adjust({ product_id: p.id, type: "IN", quantity: 5, notes: "kulakan" }, adminId);
      expect(r.current_stock).toBe(15);
    });
    it("OUT melebihi stok ditolak (data uji 4)", async () => {
      const p = await mk({ sku: "SKU-03", current_stock: 5 });
      await expect(
        svc.stockService.adjust({ product_id: p.id, type: "OUT", quantity: 7, notes: "rusak" }, adminId),
      ).rejects.toMatchObject({ code: "INSUFFICIENT_STOCK", message: "Jumlah penyesuaian keluar melebihi stok yang tersedia saat ini" });
    });
    it("ADJUSTMENT mengatur stok ke hasil opname", async () => {
      const p = await mk();
      const r = await svc.stockService.adjust({ product_id: p.id, type: "ADJUSTMENT", quantity: 7, notes: "opname" }, adminId);
      expect(r.current_stock).toBe(7);
    });
    it("dua mutasi OUT bersamaan tidak membuat stok negatif", async () => {
      const p = await mk({ current_stock: 5 });
      const res = await Promise.allSettled([
        svc.stockService.adjust({ product_id: p.id, type: "OUT", quantity: 4, notes: "a" }, adminId),
        svc.stockService.adjust({ product_id: p.id, type: "OUT", quantity: 4, notes: "b" }, adminId),
      ]);
      expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const list = await svc.productService.list("ADMIN", { limit: 5, offset: 0, search: "", sortBy: "name", sortOrder: "asc" });
      expect(list.items[0].current_stock).toBe(1);
    });
  });

  describe("penjualan", () => {
    it("transaksi normal: stok, total, laba (data uji 1) + dashboard + batal", async () => {
      const p = await mk();
      const sale = await svc.saleService.create({ payment_method: "CASH", items: [{ product_id: p.id, quantity: 2 }] }, adminId);
      expect(sale.total_amount).toBe(30000);
      expect(sale.status).toBe("COMPLETED");

      const afterSale = await svc.productService.list("ADMIN", { limit: 5, offset: 0, search: "", sortBy: "name", sortOrder: "asc" });
      expect(afterSale.items[0].current_stock).toBe(8);

      const sum = await svc.saleService.dailySummary("ADMIN");
      expect(sum).toMatchObject({ total_sales_count: 1, total_revenue: 30000, total_profit: 10000 });
      const staffSum = await svc.saleService.dailySummary("STAFF");
      expect(staffSum).toMatchObject({ total_sales_count: 1, total_revenue: 30000, total_profit: 0 });

      await svc.saleService.cancel(sale.id);
      const restored = await svc.productService.list("ADMIN", { limit: 5, offset: 0, search: "", sortBy: "name", sortOrder: "asc" });
      expect(restored.items[0].current_stock).toBe(10);
      expect(await svc.saleService.dailySummary("ADMIN")).toMatchObject({ total_sales_count: 0, total_revenue: 0, total_profit: 0 });
      await expect(svc.saleService.cancel(sale.id)).rejects.toMatchObject({ code: "ALREADY_CANCELLED" });
    });
    it("kuantitas melebihi stok ditolak dengan pesan PRD (data uji 3)", async () => {
      const p = await mk({ sku: "SKU-02", current_stock: 3 });
      await expect(
        svc.saleService.create({ payment_method: "CASH", items: [{ product_id: p.id, quantity: 4 }] }, adminId),
      ).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT", message: "Stok tidak mencukupi untuk SKU-02. Sisa stok: 3" });
    });
    it("transaksi gagal membatalkan semua (atomik)", async () => {
      const a = await mk({ sku: "A", current_stock: 5 });
      const b = await mk({ sku: "B", current_stock: 1 });
      await expect(
        svc.saleService.create(
          { payment_method: "CASH", items: [{ product_id: a.id, quantity: 2 }, { product_id: b.id, quantity: 2 }] },
          adminId,
        ),
      ).rejects.toMatchObject({ code: "STOCK_INSUFFICIENT" });
      const list = await svc.productService.list("ADMIN", { limit: 5, offset: 0, search: "", sortBy: "sku", sortOrder: "asc" });
      expect(list.items.map((i) => i.current_stock)).toEqual([5, 1]);
    });
    it("dua kasir berebut stok terakhir: hanya satu berhasil", async () => {
      const p = await mk({ current_stock: 1 });
      const input = { payment_method: "CASH" as const, items: [{ product_id: p.id, quantity: 1 }] };
      const res = await Promise.allSettled([svc.saleService.create(input, adminId), svc.saleService.create(input, adminId)]);
      expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = res.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(failed.reason).toMatchObject({ code: "STOCK_INSUFFICIENT" });
    });
    it("STAFF tidak menerima laba di daftar dan HPP di detail", async () => {
      const p = await mk();
      const s = await svc.saleService.create({ payment_method: "TRANSFER", items: [{ product_id: p.id, quantity: 1 }] }, adminId);
      const list = await svc.saleService.list("STAFF", { limit: 10, offset: 0 });
      expect(list.items[0]).not.toHaveProperty("gross_profit");
      const detail = await svc.saleService.detail(s.id, "STAFF");
      expect(detail.items[0]).not.toHaveProperty("cost_price_at_sale");
    });
  });

  describe("auth", () => {
    it("email/password salah menghasilkan INVALID_CREDENTIALS yang sama", async () => {
      await expect(svc.authService.login("a@x.id", "salah-salah", "ip-1")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
      await expect(svc.authService.login("nope@x.id", "salah-salah", "ip-2")).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
      await expect(svc.authService.login("a@x.id", "password123", "ip-3")).resolves.toMatchObject({ role: "ADMIN" });
    });
    it("6 kegagalan berturut-turut kena 429", async () => {
      for (let i = 0; i < 5; i++) await svc.authService.login("a@x.id", "salah-salah", "ip-9").catch(() => {});
      await expect(svc.authService.login("a@x.id", "password123", "ip-9")).rejects.toMatchObject({ status: 429 });
    });
  });
});
