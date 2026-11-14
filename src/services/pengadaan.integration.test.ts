import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Integration test integrasi pengadaan; hanya jalan bila TEST_DATABASE_URL diisi (database terpisah). */
const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

describe.skipIf(!TEST_URL)("integrasi pengadaan", () => {
  let dbm: typeof import("@/db");
  let svc: typeof import("@/services");
  let peng: typeof import("@/services/pengadaan");
  let ids: { a: string; b: string };

  beforeAll(async () => {
    dbm = await import("@/db");
    svc = await import("@/services");
    peng = await import("@/services/pengadaan");
    await migrate(dbm.getDb(), { migrationsFolder: "./drizzle" });
  });

  beforeEach(async () => {
    await dbm.getDb().execute(
      sql.raw(
        "TRUNCATE pengadaan_receipts, pengadaan_invoices, stock_adjustments, sale_items, sales, products, users RESTART IDENTITY CASCADE",
      ),
    );
    const mk = (sku: string, name: string, stock: number) =>
      svc.productService.create(
        { sku, name, unit: "pcs", category: "Seragam", cost_price: 1000, selling_price: 2000, current_stock: stock },
        "ADMIN",
      );
    ids = { a: (await mk("SRG-001", "Seragam", 10)).id, b: (await mk("SPT-001", "Sepatu", 0)).id };
  });

  afterAll(async () => {
    await dbm.closeDb();
  });

  const stockOf = async (id: string) =>
    (await svc.productService.list("ADMIN", { limit: 100, offset: 0, search: "", sortBy: "name", sortOrder: "asc" })).items.find(
      (p) => p.id === id,
    )!.current_stock;

  const goods = (over: Record<string, unknown> = {}) =>
    ({
      type: "goods_received",
      receipt_no: "BD-1",
      po_number: "PO-530",
      received_date: "2026-11-10",
      items: [
        { sku: "srg-001", quantity: 5 },
        { sku: "SPT-001", quantity: 3 },
        { sku: "SRG-001", quantity: 2 },
      ],
      ...over,
    }) as Parameters<typeof peng.pengadaanService.handle>[0];

  it("barang datang menambah stok, SKU kembar digabung, dan tercatat sebagai mutasi IN", async () => {
    const r = await peng.pengadaanService.handle(goods());
    expect(r.duplicate).toBe(false);
    expect(await stockOf(ids.a)).toBe(17);
    expect(await stockOf(ids.b)).toBe(3);
    const adj = await svc.stockService.list({ limit: 10, offset: 0 });
    expect(adj.total).toBe(2);
    expect(adj.items.every((i) => i.type === "IN" && i.notes.includes("PO-530"))).toBe(true);
    const list = await peng.pengadaanService.listReceipts({ limit: 10, offset: 0 });
    expect(list.items[0].total_qty).toBe(10);
  });

  it("kiriman ulang dengan receipt_no sama tidak menambah stok dua kali", async () => {
    await peng.pengadaanService.handle(goods());
    const again = await peng.pengadaanService.handle(goods());
    expect(again.duplicate).toBe(true);
    expect(await stockOf(ids.a)).toBe(17);
  });

  it("SKU tidak dikenal menolak seluruh kiriman (stok tak berubah, tidak tercatat)", async () => {
    await expect(
      peng.pengadaanService.handle(goods({ items: [{ sku: "SRG-001", quantity: 5 }, { sku: "XXX-999", quantity: 1 }] })),
    ).rejects.toMatchObject({ status: 422, code: "SKU_NOT_FOUND" });
    expect(await stockOf(ids.a)).toBe(10);
    expect((await peng.pengadaanService.listReceipts({ limit: 10, offset: 0 })).total).toBe(0);
  });

  const inv = (over: Record<string, unknown> = {}) =>
    ({
      type: "invoice",
      invoice_number: "TG-1",
      issued_date: "2026-11-10",
      due_date: "2026-11-30",
      total_amount: 5_000_000,
      status: "MENDATANG",
      items: [],
      ...over,
    }) as Parameters<typeof peng.pengadaanService.handle>[0];

  it("tagihan di-upsert per nomor, ringkasan menghitung yang akan datang dan yang lewat", async () => {
    await peng.pengadaanService.handle(inv());
    await peng.pengadaanService.handle(inv({ total_amount: 6_000_000 }));
    await peng.pengadaanService.handle(inv({ invoice_number: "TG-2", due_date: "2026-11-01", total_amount: 1_000_000 }));
    const list = await peng.pengadaanService.listInvoices({ limit: 10, offset: 0, status: "MENDATANG" });
    expect(list.total).toBe(2);
    expect(list.items[0].invoice_number).toBe("TG-2");
    const s = await peng.pengadaanService.summary(new Date("2026-11-14T03:00:00Z"));
    expect(s).toMatchObject({ upcoming_count: 2, upcoming_total: 7_000_000, nearest_due: "2026-11-01", overdue_count: 1 });
  });

  it("tagihan yang sudah lunas tidak ditimpa kiriman susulan; DIBATALKAN tidak bisa dilunasi", async () => {
    const created = await peng.pengadaanService.handle(inv());
    const id = (created as { invoice: { id: string } }).invoice.id;
    const paid = await peng.pengadaanService.setInvoiceStatus(id, { status: "LUNAS" });
    expect(paid.status).toBe("LUNAS");
    expect(paid.paid_at).not.toBeNull();
    const again = await peng.pengadaanService.handle(inv({ total_amount: 9_000_000 }));
    expect(again.duplicate).toBe(true);
    expect((await peng.pengadaanService.listInvoices({ limit: 10, offset: 0, status: "LUNAS" })).items[0].total_amount).toBe(5_000_000);

    const c2 = await peng.pengadaanService.handle(inv({ invoice_number: "TG-9", status: "DIBATALKAN" }));
    await expect(
      peng.pengadaanService.setInvoiceStatus((c2 as { invoice: { id: string } }).invoice.id, { status: "LUNAS" }),
    ).rejects.toMatchObject({ code: "INVOICE_CANCELLED" });
  });
});
