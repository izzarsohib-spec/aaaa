import type { z } from "zod";
import { toJakartaDate } from "@/lib/calculations";
import { AppError, notFound } from "@/lib/errors";
import type { PengadaanEvent, invoiceActionSchema } from "@/lib/validation";
import { db, runInTransaction } from "@/repositories";
import { pengadaanRepo } from "@/repositories/pengadaan";
import type { Executor, Tx } from "@/db";

type Receipt = Awaited<ReturnType<typeof pengadaanRepo.insertReceipt>>;
type Issue = Awaited<ReturnType<typeof pengadaanRepo.insertIssue>>;
type Invoice = Awaited<ReturnType<typeof pengadaanRepo.insertInvoice>>;
type GoodsEvent = Extract<PengadaanEvent, { type: "goods_received" }>;
type IssueEvent = Extract<PengadaanEvent, { type: "goods_issued" }>;
type InvoiceEvent = Extract<PengadaanEvent, { type: "invoice" }>;

const toReceiptDto = (r: Receipt) => ({
  id: r.id,
  receipt_no: r.receiptNo,
  po_number: r.poNumber,
  received_date: r.receivedDate,
  notes: r.notes,
  items: r.items,
  total_qty: r.totalQty,
  created_at: r.createdAt,
});

const toIssueDto = (r: Issue) => ({
  id: r.id,
  issue_no: r.issueNo,
  po_number: r.poNumber,
  issued_date: r.issuedDate,
  notes: r.notes,
  items: r.items,
  total_qty: r.totalQty,
  created_at: r.createdAt,
});

const toInvoiceDto = (i: Invoice) => ({
  id: i.id,
  invoice_number: i.invoiceNumber,
  issued_date: i.issuedDate,
  due_date: i.dueDate,
  total_amount: i.totalAmount,
  status: i.status,
  notes: i.notes,
  items: i.items,
  paid_at: i.paidAt,
  created_at: i.createdAt,
});

async function requireClient(ex: Executor, code: string) {
  const client = await pengadaanRepo.findClientByCode(ex, code);
  if (!client) throw new AppError(422, "CLIENT_NOT_FOUND", "Klien belum terdaftar di toko: " + code);
  return client;
}

/** Gabungkan SKU kembar (beda huruf besar/kecil) dan pastikan semuanya ada di toko; semua-atau-tidak. */
async function resolveItems(tx: Tx, items: { sku: string; quantity: number }[]) {
  const wanted = new Map<string, number>();
  for (const it of items) {
    const k = it.sku.toLowerCase();
    wanted.set(k, (wanted.get(k) ?? 0) + it.quantity);
  }
  const locked = await pengadaanRepo.lockActiveBySkus(tx, [...wanted.keys()]);
  const bySku = new Map(locked.map((p) => [p.sku.toLowerCase(), p]));
  const missing = new Set(items.filter((i) => !bySku.has(i.sku.toLowerCase())).map((i) => i.sku));
  if (missing.size) {
    throw new AppError(
      422,
      "SKU_NOT_FOUND",
      "SKU belum ada di toko, stok titipan tidak diubah: " + [...missing].join(", "),
      Object.fromEntries([...missing].map((s) => [s, "SKU tidak ditemukan"])),
    );
  }
  return {
    lines: [...wanted].map(([k, quantity]) => ({ product: bySku.get(k)!, quantity })),
    total: [...wanted.values()].reduce((a, b) => a + b, 0),
  };
}

/** Barang datang dari Mas Wahyu di klien: menambah stok titipan klien, bukan stok produk toko. Idempoten per receipt_no. */
async function receive(input: GoodsEvent) {
  return runInTransaction(async (tx) => {
    const existing = await pengadaanRepo.findReceipt(tx, input.receipt_no);
    if (existing) return { duplicate: true, receipt: toReceiptDto(existing) };

    const client = await requireClient(tx, input.client);
    const { lines, total } = await resolveItems(tx, input.items);
    await pengadaanRepo.insertMoves(
      tx,
      lines.map((l) => ({
        clientId: client.id,
        productId: l.product.id,
        direction: "IN" as const,
        quantity: l.quantity,
        docNo: input.receipt_no,
        docDate: input.received_date,
        notes: input.notes ?? null,
      })),
    );
    const receipt = await pengadaanRepo.insertReceipt(tx, {
      receiptNo: input.receipt_no,
      clientId: client.id,
      poNumber: input.po_number ?? null,
      receivedDate: input.received_date,
      notes: input.notes ?? null,
      items: lines.map((l) => ({ sku: l.product.sku, name: l.product.name, quantity: l.quantity })),
      totalQty: total,
    });
    return { duplicate: false, receipt: toReceiptDto(receipt) };
  });
}

/** Barang keluar dari titipan klien (dikirim ke lokasi): mengurangi stok titipan. Idempoten per issue_no. */
async function issue(input: IssueEvent) {
  return runInTransaction(async (tx) => {
    const existing = await pengadaanRepo.findIssue(tx, input.issue_no);
    if (existing) return { duplicate: true, issue: toIssueDto(existing) };

    const client = await requireClient(tx, input.client);
    const { lines, total } = await resolveItems(tx, input.items);
    await pengadaanRepo.insertMoves(
      tx,
      lines.map((l) => ({
        clientId: client.id,
        productId: l.product.id,
        direction: "OUT" as const,
        quantity: l.quantity,
        docNo: input.issue_no,
        docDate: input.issued_date,
        notes: input.notes ?? null,
      })),
    );
    const row = await pengadaanRepo.insertIssue(tx, {
      issueNo: input.issue_no,
      clientId: client.id,
      poNumber: input.po_number ?? null,
      issuedDate: input.issued_date,
      notes: input.notes ?? null,
      items: lines.map((l) => ({ sku: l.product.sku, name: l.product.name, quantity: l.quantity })),
      totalQty: total,
    });
    return { duplicate: false, issue: toIssueDto(row) };
  });
}

async function upsertInvoice(input: InvoiceEvent) {
  return runInTransaction(async (tx) => {
    const values = {
      issuedDate: input.issued_date,
      dueDate: input.due_date ?? null,
      totalAmount: input.total_amount,
      notes: input.notes ?? null,
      items: input.items,
    };
    const existing = await pengadaanRepo.lockInvoiceByNumber(tx, input.invoice_number);
    if (!existing) {
      const client = await requireClient(tx, input.client);
      const row = await pengadaanRepo.insertInvoice(tx, {
        invoiceNumber: input.invoice_number,
        clientId: client.id,
        status: input.status,
        ...values,
      });
      return { duplicate: false, invoice: toInvoiceDto(row) };
    }
    // Tagihan yang sudah ditandai lunas oleh Mas Wahyu tidak boleh ditimpa kiriman susulan.
    if (existing.status === "LUNAS") return { duplicate: true, invoice: toInvoiceDto(existing) };
    const row = await pengadaanRepo.updateInvoice(tx, existing.id, { status: input.status, ...values });
    return { duplicate: false, invoice: toInvoiceDto(row) };
  });
}

function handle(event: PengadaanEvent) {
  if (event.type === "goods_received") return receive(event);
  if (event.type === "goods_issued") return issue(event);
  return upsertInvoice(event);
}

export const pengadaanService = {
  handle,

  async listReceipts(o: { limit: number; offset: number }) {
    const { items, total } = await pengadaanRepo.listReceipts(db(), o);
    return { items: items.map(toReceiptDto), total };
  },

  async listInvoices(o: {
    limit: number;
    offset: number;
    status?: "MENDATANG" | "LUNAS" | "DIBATALKAN";
    client?: string;
  }) {
    const client = o.client ? await pengadaanRepo.findClientByCode(db(), o.client) : null;
    if (o.client && !client) throw notFound("Klien tidak ditemukan");
    const { items, total } = await pengadaanRepo.listInvoices(db(), {
      limit: o.limit,
      offset: o.offset,
      status: o.status,
      clientId: client?.id,
    });
    return { items: items.map(toInvoiceDto), total };
  },

  async setInvoiceStatus(id: string, input: z.infer<typeof invoiceActionSchema>) {
    return runInTransaction(async (tx) => {
      const inv = await pengadaanRepo.lockInvoiceById(tx, id);
      if (!inv) throw notFound("Tagihan tidak ditemukan");
      if (inv.status === "DIBATALKAN") {
        throw new AppError(409, "INVOICE_CANCELLED", "Tagihan sudah dibatalkan oleh pengadaan");
      }
      const row = await pengadaanRepo.updateInvoice(tx, id, {
        status: input.status,
        paidAt: input.status === "LUNAS" ? new Date() : null,
      });
      return toInvoiceDto(row);
    });
  },

  /** Daftar klien titipan beserta ringkasan stok dan tagihan belum dibayar. */
  async listClients(now = new Date()) {
    const today = toJakartaDate(now);
    const [clients, stock, bills] = await Promise.all([
      pengadaanRepo.listClients(db()),
      pengadaanRepo.stockTotalsByClient(db()),
      pengadaanRepo.upcomingByClient(db(), today),
    ]);
    const s = new Map(stock.map((x) => [x.client_id, x]));
    const b = new Map(bills.map((x) => [x.client_id, x]));
    return clients.map((c) => {
      const st = s.get(c.id);
      const bi = b.get(c.id);
      return {
        code: c.code,
        name: c.name,
        item_count: st?.items ?? 0,
        qty_in: st?.masuk ?? 0,
        qty_out: st?.keluar ?? 0,
        qty_left: (st?.masuk ?? 0) - (st?.keluar ?? 0),
        unpaid_count: bi?.count ?? 0,
        unpaid_total: Number(bi?.total ?? 0),
        overdue_count: bi?.overdue ?? 0,
      };
    });
  },

  /** Stok titipan satu klien per barang: masuk, keluar, sisa (bisa minus bila keluar lebih besar dari catatan masuk). */
  async clientStock(code: string) {
    const client = await pengadaanRepo.findClientByCode(db(), code);
    if (!client) throw notFound("Klien tidak ditemukan");
    const rows = await pengadaanRepo.stockByClient(db(), client.id);
    return {
      client: { code: client.code, name: client.name },
      items: rows.map((r) => ({
        product_id: r.product_id,
        sku: r.sku,
        name: r.name,
        category: r.category,
        unit: r.unit,
        qty_in: r.masuk,
        qty_out: r.keluar,
        qty_left: r.masuk - r.keluar,
        last_date: r.terakhir,
      })),
    };
  },

  async summary(now = new Date()) {
    const today = toJakartaDate(now);
    const since = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
    const [up, rc] = await Promise.all([
      pengadaanRepo.upcomingAggregate(db(), today),
      pengadaanRepo.receiptsSince(db(), since),
    ]);
    return {
      upcoming_count: up.count,
      upcoming_total: Number(up.total),
      nearest_due: up.nearestDue,
      overdue_count: up.overdue,
      receipts_30d_docs: rc.docs,
      receipts_30d_qty: rc.qty,
    };
  },
};
