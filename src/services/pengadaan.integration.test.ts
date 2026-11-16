import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

/** Integration test integrasi pengadaan; hanya jalan bila TEST_DATABASE_URL diisi (database terpisah). */
const TEST_URL = process.env.TEST_DATABASE_URL;
if (TEST_URL) process.env.DATABASE_URL = TEST_URL;

describe.skipIf(!TEST_URL)("integrasi pengadaan (titipan seragam)", () => {
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
        "TRUNCATE titipan_moves, pengadaan_issues, pengadaan_receipts, pengadaan_invoices, titipan_clients, stock_adjustments, sale_items, sales, products, users RESTART IDENTITY CASCADE",
      ),
    );
    await dbm.getDb().execute(
      sql.raw("INSERT INTO titipan_clients (code, name) VALUES ('RMP', 'PT Ray Mitra Perkasa'), ('ABC', 'PT Contoh Klien')"),
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

  const productStock = async (id: string) =>
    (await svc.productService.list("ADMIN", { limit: 100, offset: 0, search: "", sortBy: "name", sortOrder: "asc" })).items.find(
      (p) => p.id === id,
    )!.current_stock;
  const left = async (code: string, sku: string) =>
    (await peng.pengadaanService.clientStock(code)).items.find((i) => i.sku === sku)?.qty_left;

  const goods = (over: Record<string, unknown> = {}) =>
    ({
      type: "goods_received",
      client: "RMP",
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

  const issued = (over: Record<string, unknown> = {}) =>
    ({
      type: "goods_issued",
      client: "RMP",
      issue_no: "BK-1",
      issued_date: "2026-11-12",
      items: [{ sku: "SRG-001", quantity: 4 }],
      ...over,
    }) as Parameters<typeof peng.pengadaanService.handle>[0];

  it("barang datang menambah stok TITIPAN klien (SKU kembar digabung) dan tidak mengubah stok produk toko", async () => {
    const r = await peng.pengadaanService.handle(goods());
    expect(r.duplicate).toBe(false);
    expect(await left("RMP", "SRG-001")).toBe(7);
    expect(await left("RMP", "SPT-001")).toBe(3);
    // stok eceran toko tidak tersentuh dan tidak ada mutasi stok toko
    expect(await productStock(ids.a)).toBe(10);
    expect(await productStock(ids.b)).toBe(0);
    expect((await svc.stockService.list({ limit: 10, offset: 0 })).total).toBe(0);
    const list = await peng.pengadaanService.listReceipts({ limit: 10, offset: 0 });
    expect(list.items[0].total_qty).toBe(10);
  });

  it("kiriman ulang dengan receipt_no sama tidak menambah stok titipan dua kali", async () => {
    await peng.pengadaanService.handle(goods());
    const again = await peng.pengadaanService.handle(goods());
    expect(again.duplicate).toBe(true);
    expect(await left("RMP", "SRG-001")).toBe(7);
  });

  it("barang keluar mengurangi stok titipan, idempoten per issue_no, dan mencatat total masuk/keluar", async () => {
    await peng.pengadaanService.handle(goods());
    const out = await peng.pengadaanService.handle(issued());
    expect(out.duplicate).toBe(false);
    expect(await left("RMP", "SRG-001")).toBe(3);
    const again = await peng.pengadaanService.handle(issued());
    expect(again.duplicate).toBe(true);
    expect(await left("RMP", "SRG-001")).toBe(3);
    const row = (await peng.pengadaanService.clientStock("RMP")).items.find((i) => i.sku === "SRG-001")!;
    expect(row).toMatchObject({ qty_in: 7, qty_out: 4, qty_left: 3, last_date: "2026-11-12" });
    expect(await productStock(ids.a)).toBe(10);
  });

  it("barang keluar lebih banyak dari yang masuk tetap tercatat dan sisanya minus (tidak memblokir antrean)", async () => {
    await peng.pengadaanService.handle(issued({ items: [{ sku: "SRG-001", quantity: 2 }] }));
    expect(await left("RMP", "SRG-001")).toBe(-2);
  });

  it("SKU tidak dikenal menolak seluruh kiriman (stok titipan tak berubah, tidak tercatat)", async () => {
    await expect(
      peng.pengadaanService.handle(goods({ items: [{ sku: "SRG-001", quantity: 5 }, { sku: "XXX-999", quantity: 1 }] })),
    ).rejects.toMatchObject({ status: 422, code: "SKU_NOT_FOUND" });
    expect((await peng.pengadaanService.clientStock("RMP")).items).toHaveLength(0);
    expect((await peng.pengadaanService.listReceipts({ limit: 10, offset: 0 })).total).toBe(0);
    await expect(peng.pengadaanService.handle(issued({ items: [{ sku: "XXX-999", quantity: 1 }] }))).rejects.toMatchObject({
      code: "SKU_NOT_FOUND",
    });
  });

  it("klien tidak dikenal ditolak, dan stok titipan terpisah per klien", async () => {
    await expect(peng.pengadaanService.handle(goods({ client: "NOPE" }))).rejects.toMatchObject({
      status: 422,
      code: "CLIENT_NOT_FOUND",
    });
    await peng.pengadaanService.handle(goods());
    await peng.pengadaanService.handle(goods({ client: "ABC", receipt_no: "BD-2", items: [{ sku: "SRG-001", quantity: 1 }] }));
    expect(await left("RMP", "SRG-001")).toBe(7);
    expect(await left("ABC", "SRG-001")).toBe(1);
    await expect(peng.pengadaanService.clientStock("NOPE")).rejects.toMatchObject({ status: 404 });
  });

  it("kiriman tanpa field client dianggap klien RMP (kompatibel dengan pengirim lama)", async () => {
    const { pengadaanEventSchema } = await import("@/lib/validation");
    const parsed = pengadaanEventSchema.parse({
      type: "goods_received",
      receipt_no: "BD-9",
      received_date: "2026-11-10",
      items: [{ sku: "SRG-001", quantity: 1 }],
    });
    expect(parsed.client).toBe("RMP");
    await peng.pengadaanService.handle(parsed);
    expect(await left("RMP", "SRG-001")).toBe(1);
  });

  it("daftar klien menampilkan sisa stok titipan dan tagihan belum dibayar per klien", async () => {
    await peng.pengadaanService.handle(goods());
    await peng.pengadaanService.handle(issued());
    await peng.pengadaanService.handle(inv({ total_amount: 2_000_000 }));
    await peng.pengadaanService.handle(inv({ invoice_number: "TG-A", client: "ABC", total_amount: 700_000 }));
    const clients = await peng.pengadaanService.listClients(new Date("2026-11-14T03:00:00Z"));
    const rmp = clients.find((c) => c.code === "RMP")!;
    const abc = clients.find((c) => c.code === "ABC")!;
    expect(rmp).toMatchObject({ item_count: 2, qty_in: 10, qty_out: 4, qty_left: 6, unpaid_count: 1, unpaid_total: 2_000_000 });
    expect(abc).toMatchObject({ item_count: 0, qty_left: 0, unpaid_count: 1, unpaid_total: 700_000 });
    const onlyAbc = await peng.pengadaanService.listInvoices({ limit: 10, offset: 0, client: "ABC" });
    expect(onlyAbc.items.map((i) => i.invoice_number)).toEqual(["TG-A"]);
  });

  it("riwayat barang masuk dan keluar: terbaru di atas, bisa disaring arah dan dicari, membawa nomor dokumen, terpisah per klien", async () => {
    await peng.pengadaanService.handle(goods()); // BD-1, PO-530, 2026-11-10: SRG-001 x7, SPT-001 x3
    await peng.pengadaanService.handle(issued({ po_number: "SJ/2026/11/0001" })); // BK-1, 2026-11-12: SRG-001 x4
    await peng.pengadaanService.handle(goods({ client: "ABC", receipt_no: "BD-2", items: [{ sku: "SPT-001", quantity: 9 }] }));

    const all = await peng.pengadaanService.clientMoves("RMP", { limit: 10, offset: 0 });
    expect(all.total).toBe(3);
    expect(all.items[0]).toMatchObject({ direction: "OUT", doc_no: "BK-1", ref_no: "SJ/2026/11/0001", sku: "SRG-001", quantity: 4 });
    expect(all.items.map((m) => m.doc_date)).toEqual(["2026-11-12", "2026-11-10", "2026-11-10"]);

    const masuk = await peng.pengadaanService.clientMoves("RMP", { limit: 10, offset: 0, direction: "IN" });
    expect(masuk.total).toBe(2);
    expect(masuk.items.every((m) => m.direction === "IN" && m.ref_no === "PO-530")).toBe(true);

    expect((await peng.pengadaanService.clientMoves("RMP", { limit: 10, offset: 0, search: "sepatu" })).total).toBe(1);
    expect((await peng.pengadaanService.clientMoves("RMP", { limit: 10, offset: 0, search: "BK-1" })).total).toBe(1);
    expect((await peng.pengadaanService.clientMoves("RMP", { limit: 10, offset: 0, search: "%" })).total).toBe(0);

    const page2 = await peng.pengadaanService.clientMoves("RMP", { limit: 2, offset: 2 });
    expect(page2.items).toHaveLength(1);
    expect(page2.total).toBe(3);

    expect((await peng.pengadaanService.clientMoves("ABC", { limit: 10, offset: 0 })).items.map((m) => m.doc_no)).toEqual(["BD-2"]);
    await expect(peng.pengadaanService.clientMoves("NOPE", { limit: 10, offset: 0 })).rejects.toMatchObject({ status: 404 });
  });

  const inv = (over: Record<string, unknown> = {}) =>
    ({
      type: "invoice",
      client: "RMP",
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

  it("tagihan tanpa jatuh tempo diterima, tidak dihitung lewat tempo, dan tampil paling akhir", async () => {
    await peng.pengadaanService.handle(inv({ invoice_number: "TG-N", due_date: null }));
    await peng.pengadaanService.handle(inv({ invoice_number: "TG-D", due_date: "2026-12-31" }));
    const list = await peng.pengadaanService.listInvoices({ limit: 10, offset: 0, status: "MENDATANG" });
    expect(list.items.map((i) => i.invoice_number)).toEqual(["TG-D", "TG-N"]);
    expect(list.items[1].due_date).toBeNull();
    const s = await peng.pengadaanService.summary(new Date("2027-01-15T03:00:00Z"));
    expect(s).toMatchObject({ upcoming_count: 2, nearest_due: "2026-12-31", overdue_count: 1 });
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
