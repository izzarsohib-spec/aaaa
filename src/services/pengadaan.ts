import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import type { z } from "zod";
import { toJakartaDate } from "@/lib/calculations";
import { AppError, notFound } from "@/lib/errors";
import type { PengadaanEvent, invoiceActionSchema } from "@/lib/validation";
import { db, productRepo, runInTransaction, stockRepo } from "@/repositories";
import { pengadaanRepo } from "@/repositories/pengadaan";

type Receipt = Awaited<ReturnType<typeof pengadaanRepo.insertReceipt>>;
type Invoice = Awaited<ReturnType<typeof pengadaanRepo.insertInvoice>>;
type GoodsEvent = Extract<PengadaanEvent, { type: "goods_received" }>;
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

/** Terapkan satu kiriman dari sistem pengadaan. Idempoten: kiriman ulang tidak mengubah apa pun. */
async function receive(input: GoodsEvent) {
  // Gabungkan SKU kembar (beda huruf besar/kecil) supaya mutasi stok satu per produk.
  const wanted = new Map<string, number>();
  for (const it of input.items) {
    const k = it.sku.toLowerCase();
    wanted.set(k, (wanted.get(k) ?? 0) + it.quantity);
  }
  const hash = await bcrypt.hash(randomBytes(24).toString("hex"), 12);

  return runInTransaction(async (tx) => {
    const existing = await pengadaanRepo.findReceipt(tx, input.receipt_no);
    if (existing) return { duplicate: true, receipt: toReceiptDto(existing) };

    const locked = await pengadaanRepo.lockActiveBySkus(tx, [...wanted.keys()]);
    const bySku = new Map(locked.map((p) => [p.sku.toLowerCase(), p]));
    const missing = new Set(input.items.filter((i) => !bySku.has(i.sku.toLowerCase())).map((i) => i.sku));
    if (missing.size) {
      throw new AppError(
        422,
        "SKU_NOT_FOUND",
        "SKU belum ada di toko, stok tidak diubah: " + [...missing].join(", "),
        Object.fromEntries([...missing].map((s) => [s, "SKU tidak ditemukan"])),
      );
    }

    const userId = await pengadaanRepo.ensureSystemUser(tx, hash);
    const note =
      "Barang datang dari pengadaan" +
      (input.po_number ? " (PO " + input.po_number + ")" : "") +
      ", penerimaan " +
      input.receipt_no;
    for (const [k, quantity] of wanted) {
      const p = bySku.get(k)!;
      await productRepo.setStock(tx, p.id, p.currentStock + quantity);
      await stockRepo.insert(tx, { productId: p.id, userId, type: "IN", quantity, notes: note });
    }
    const receipt = await pengadaanRepo.insertReceipt(tx, {
      receiptNo: input.receipt_no,
      poNumber: input.po_number ?? null,
      receivedDate: input.received_date,
      notes: input.notes ?? null,
      items: [...wanted].map(([k, quantity]) => ({ sku: bySku.get(k)!.sku, name: bySku.get(k)!.name, quantity })),
      totalQty: [...wanted.values()].reduce((a, b) => a + b, 0),
    });
    return { duplicate: false, receipt: toReceiptDto(receipt) };
  });
}

async function upsertInvoice(input: InvoiceEvent) {
  return runInTransaction(async (tx) => {
    const values = {
      issuedDate: input.issued_date,
      dueDate: input.due_date,
      totalAmount: input.total_amount,
      notes: input.notes ?? null,
      items: input.items,
    };
    const existing = await pengadaanRepo.lockInvoiceByNumber(tx, input.invoice_number);
    if (!existing) {
      const row = await pengadaanRepo.insertInvoice(tx, {
        invoiceNumber: input.invoice_number,
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

export const pengadaanService = {
  handle: (event: PengadaanEvent) => (event.type === "goods_received" ? receive(event) : upsertInvoice(event)),

  async listReceipts(o: { limit: number; offset: number }) {
    const { items, total } = await pengadaanRepo.listReceipts(db(), o);
    return { items: items.map(toReceiptDto), total };
  },

  async listInvoices(o: { limit: number; offset: number; status?: "MENDATANG" | "LUNAS" | "DIBATALKAN" }) {
    const { items, total } = await pengadaanRepo.listInvoices(db(), o);
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
