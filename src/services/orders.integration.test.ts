import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

describe.skipIf(!TEST_URL)("toko online + pesanan", () => {
  let dbm: typeof import("@/db");
  let svc: typeof import("@/services");
  let ord: typeof import("@/services/orders");
  let adminId: string;
  let pid: string;

  const base = {
    customer_name: "Budi Santoso",
    phone: "0812 3456 7890",
    address: "Jl. Merdeka No. 123",
    city: "Semarang",
    shipping_method: "JNE_REG" as const,
  };

  beforeAll(async () => {
    dbm = await import("@/db");
    svc = await import("@/services");
    ord = await import("@/services/orders");
    await migrate(dbm.getDb(), { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await dbm.getDb().execute(
      sql.raw("TRUNCATE order_events, order_items, orders, sale_items, sales, stock_adjustments, products, users RESTART IDENTITY CASCADE"),
    );
    adminId = (await svc.userService.create({ email: "a@x.id", name: "Admin", password: "password123", role: "ADMIN" })).id;
    const p = await svc.productService.create(
      { sku: "SRG-1", name: "Seragam", unit: "pcs", category: "Seragam Satpam", cost_price: 10000, selling_price: 15000, current_stock: 10 },
      "ADMIN",
    );
    pid = p.id;
  });

  afterAll(async () => {
    await dbm.closeDb();
  });

  const stock = async () =>
    (await svc.productService.list("ADMIN", { limit: 5, offset: 0, search: "", sortBy: "name", sortOrder: "asc" })).items[0].current_stock;

  it("katalog publik tidak membawa cost_price", async () => {
    const { items } = await ord.shopService.listProducts({ limit: 10, offset: 0, search: "", sort: "newest", inStockOnly: false });
    expect(items[0]).not.toHaveProperty("cost_price");
    expect(items[0]).toHaveProperty("selling_price", 15000);
  });

  it("pesanan memotong stok, total = barang + ongkir dihitung server, HP dinormalkan", async () => {
    const o = await ord.orderService.create({ ...base, items: [{ product_id: pid, quantity: 2 }] });
    expect(o.subtotal).toBe(30000);
    expect(o.shipping_cost).toBe(25000);
    expect(o.total_amount).toBe(55000);
    expect(o.status).toBe("MENUNGGU_PEMBAYARAN");
    expect(await stock()).toBe(8);
    const found = await ord.orderService.lookup(o.order_number, "+6281234567890");
    expect(found.order_number).toBe(o.order_number);
  });

  it("lookup dengan nomor HP salah -> NOT_FOUND", async () => {
    const o = await ord.orderService.create({ ...base, items: [{ product_id: pid, quantity: 1 }] });
    await expect(ord.orderService.lookup(o.order_number, "081200000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("stok tidak cukup ditolak dan tidak ada yang terpotong", async () => {
    await expect(ord.orderService.create({ ...base, items: [{ product_id: pid, quantity: 11 }] })).rejects.toMatchObject({
      code: "STOCK_INSUFFICIENT",
    });
    expect(await stock()).toBe(10);
  });

  it("nomor HP tidak valid ditolak dengan pesan di field phone", async () => {
    await expect(ord.orderService.create({ ...base, phone: "123", items: [{ product_id: pid, quantity: 1 }] })).rejects.toMatchObject({
      status: 400,
      errors: { phone: "Nomor WhatsApp tidak valid" },
    });
  });

  it("alur penuh: klaim bayar -> konfirmasi (jadi penjualan, ongkir tidak masuk omset) -> kirim -> selesai", async () => {
    const o = await ord.orderService.create({ ...base, items: [{ product_id: pid, quantity: 2 }] });
    const claimed = await ord.orderService.claimPaid(o.order_number, base.phone);
    expect(claimed.status).toBe("MENUNGGU_KONFIRMASI");

    const confirmed = await ord.orderService.act(o.id, { action: "confirm_payment" }, adminId, true);
    expect(confirmed.status).toBe("DIPROSES");
    expect(confirmed.sale_id).toBeTruthy();
    expect(await svc.saleService.dailySummary("ADMIN")).toMatchObject({ total_sales_count: 1, total_revenue: 30000, total_profit: 10000 });
    expect(await stock()).toBe(8); // tidak dipotong dua kali

    const shipped = await ord.orderService.act(o.id, { action: "ship", tracking_number: "JNE123" }, adminId, true);
    expect(shipped.tracking_number).toBe("JNE123");
    const done = await ord.orderService.act(o.id, { action: "complete" }, adminId, true);
    expect(done.status).toBe("SELESAI");
    expect(done.events.map((e) => e.status)).toEqual(["MENUNGGU_PEMBAYARAN", "MENUNGGU_KONFIRMASI", "DIPROSES", "DIKIRIM", "SELESAI"]);
  });

  it("transisi tidak sah ditolak", async () => {
    const o = await ord.orderService.create({ ...base, items: [{ product_id: pid, quantity: 1 }] });
    await expect(ord.orderService.act(o.id, { action: "ship" }, adminId, true)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
    await ord.orderService.act(o.id, { action: "confirm_payment" }, adminId, true);
    await expect(ord.orderService.act(o.id, { action: "confirm_payment" }, adminId, true)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("batal: stok kembali, penjualan terkait ikut dibatalkan, omset kembali 0; STAFF tidak boleh batal", async () => {
    const o = await ord.orderService.create({ ...base, items: [{ product_id: pid, quantity: 3 }] });
    await ord.orderService.act(o.id, { action: "confirm_payment" }, adminId, true);
    await expect(ord.orderService.act(o.id, { action: "cancel" }, adminId, false)).rejects.toMatchObject({ status: 403 });
    const c = await ord.orderService.act(o.id, { action: "cancel" }, adminId, true);
    expect(c.status).toBe("DIBATALKAN");
    expect(await stock()).toBe(10);
    expect(await svc.saleService.dailySummary("ADMIN")).toMatchObject({ total_sales_count: 0, total_revenue: 0 });
    await expect(ord.orderService.act(o.id, { action: "cancel" }, adminId, true)).rejects.toMatchObject({ code: "INVALID_TRANSITION" });
  });

  it("dua pembeli berebut stok terakhir: hanya satu berhasil", async () => {
    const p2 = await svc.productService.create(
      { sku: "LAST", name: "Terakhir", unit: "pcs", category: "Topi", cost_price: 1, selling_price: 2, current_stock: 1 },
      "ADMIN",
    );
    const mk = () => ord.orderService.create({ ...base, items: [{ product_id: p2.id, quantity: 1 }] });
    const res = await Promise.allSettled([mk(), mk()]);
    expect(res.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
});
