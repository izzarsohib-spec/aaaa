import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, or, sql } from "drizzle-orm";
import { schema, type Executor, type Tx } from "@/db";

const { users, products, pengadaanReceipts, pengadaanIssues, pengadaanInvoices, titipanClients, titipanMoves } = schema;

export const INTEGRATION_EMAIL = "integrasi-pengadaan@sistem.local";

type InvoiceStatus = "MENDATANG" | "LUNAS" | "DIBATALKAN";

export const pengadaanRepo = {
  /** Akun sistem untuk mencatat mutasi stok dari integrasi; dibuat sekali, password acak tak bisa dipakai login. */
  ensureSystemUser: async (tx: Tx, passwordHash: string) => {
    await tx
      .insert(users)
      .values({ email: INTEGRATION_EMAIL, name: "Integrasi Pengadaan", role: "STAFF", passwordHash })
      .onConflictDoNothing({ target: users.email });
    const [row] = await tx.select({ id: users.id }).from(users).where(eq(users.email, INTEGRATION_EMAIL));
    return row.id;
  },
  /** Kunci produk aktif menurut SKU (tanpa membedakan huruf besar/kecil), urut id supaya tidak deadlock. */
  lockActiveBySkus: (tx: Tx, skus: string[]) =>
    tx
      .select()
      .from(products)
      .where(
        and(
          isNull(products.deletedAt),
          inArray(
            sql`lower(${products.sku})`,
            skus.map((s) => s.toLowerCase()),
          ),
        ),
      )
      .orderBy(asc(products.id))
      .for("update"),

  findReceipt: async (ex: Executor, receiptNo: string) => {
    const [row] = await ex.select().from(pengadaanReceipts).where(eq(pengadaanReceipts.receiptNo, receiptNo));
    return row ?? null;
  },
  insertReceipt: async (tx: Tx, v: typeof pengadaanReceipts.$inferInsert) => {
    const [row] = await tx.insert(pengadaanReceipts).values(v).returning();
    return row;
  },
  listReceipts: async (ex: Executor, o: { limit: number; offset: number }) => {
    const [{ total }] = await ex.select({ total: count() }).from(pengadaanReceipts);
    const items = await ex
      .select()
      .from(pengadaanReceipts)
      .orderBy(desc(pengadaanReceipts.createdAt))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
  receiptsSince: async (ex: Executor, since: Date) => {
    const [row] = await ex
      .select({ docs: count(), qty: sql<number>`coalesce(sum(${pengadaanReceipts.totalQty}), 0)::int` })
      .from(pengadaanReceipts)
      .where(gte(pengadaanReceipts.createdAt, since));
    return row;
  },

  lockInvoiceByNumber: async (tx: Tx, invoiceNumber: string) => {
    const [row] = await tx
      .select()
      .from(pengadaanInvoices)
      .where(eq(pengadaanInvoices.invoiceNumber, invoiceNumber))
      .for("update");
    return row ?? null;
  },
  lockInvoiceById: async (tx: Tx, id: string) => {
    const [row] = await tx.select().from(pengadaanInvoices).where(eq(pengadaanInvoices.id, id)).for("update");
    return row ?? null;
  },
  insertInvoice: async (tx: Tx, v: typeof pengadaanInvoices.$inferInsert) => {
    const [row] = await tx.insert(pengadaanInvoices).values(v).returning();
    return row;
  },
  updateInvoice: async (tx: Tx, id: string, v: Partial<typeof pengadaanInvoices.$inferInsert>) => {
    const [row] = await tx.update(pengadaanInvoices).set(v).where(eq(pengadaanInvoices.id, id)).returning();
    return row;
  },
  listInvoices: async (ex: Executor, o: { limit: number; offset: number; status?: InvoiceStatus; clientId?: string }) => {
    const where = and(
      o.status ? eq(pengadaanInvoices.status, o.status) : undefined,
      o.clientId ? eq(pengadaanInvoices.clientId, o.clientId) : undefined,
    );
    const [{ total }] = await ex.select({ total: count() }).from(pengadaanInvoices).where(where);
    const items = await ex
      .select()
      .from(pengadaanInvoices)
      .where(where)
      .orderBy(asc(pengadaanInvoices.dueDate), desc(pengadaanInvoices.createdAt))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
  upcomingAggregate: async (ex: Executor, today: string, clientId?: string) => {
    const [row] = await ex
      .select({
        count: count(),
        total: sql<number>`coalesce(sum(${pengadaanInvoices.totalAmount}), 0)::bigint`,
        nearestDue: sql<string | null>`min(${pengadaanInvoices.dueDate})`,
        overdue: sql<number>`(count(*) filter (where ${pengadaanInvoices.dueDate} < ${today}))::int`,
      })
      .from(pengadaanInvoices)
      .where(and(eq(pengadaanInvoices.status, "MENDATANG"), clientId ? eq(pengadaanInvoices.clientId, clientId) : undefined));
    return row;
  },

  /* ---- Titipan seragam: klien, buku stok, pengeluaran ---- */
  findClientByCode: async (ex: Executor, code: string) => {
    const [row] = await ex.select().from(titipanClients).where(eq(sql`lower(${titipanClients.code})`, code.toLowerCase()));
    return row ?? null;
  },
  listClients: (ex: Executor) => ex.select().from(titipanClients).orderBy(asc(titipanClients.name)),
  insertMoves: async (tx: Tx, rows: (typeof titipanMoves.$inferInsert)[]) => {
    if (rows.length) await tx.insert(titipanMoves).values(rows);
  },
  findIssue: async (ex: Executor, issueNo: string) => {
    const [row] = await ex.select().from(pengadaanIssues).where(eq(pengadaanIssues.issueNo, issueNo));
    return row ?? null;
  },
  insertIssue: async (tx: Tx, v: typeof pengadaanIssues.$inferInsert) => {
    const [row] = await tx.insert(pengadaanIssues).values(v).returning();
    return row;
  },
  /** Stok titipan per produk untuk satu klien: masuk, keluar, dan sisa (masuk - keluar). */
  stockByClient: (ex: Executor, clientId: string) =>
    ex
      .select({
        product_id: products.id,
        sku: products.sku,
        name: products.name,
        category: products.category,
        unit: products.unit,
        masuk: sql<number>`coalesce(sum(case when ${titipanMoves.direction} = 'IN' then ${titipanMoves.quantity} else 0 end), 0)::int`,
        keluar: sql<number>`coalesce(sum(case when ${titipanMoves.direction} = 'OUT' then ${titipanMoves.quantity} else 0 end), 0)::int`,
        terakhir: sql<string | null>`max(${titipanMoves.docDate})`,
      })
      .from(titipanMoves)
      .innerJoin(products, eq(products.id, titipanMoves.productId))
      .where(eq(titipanMoves.clientId, clientId))
      .groupBy(products.id, products.sku, products.name, products.category, products.unit)
      .orderBy(asc(products.name)),
  /**
   * Riwayat barang masuk dan keluar titipan satu klien, terbaru di atas. ref_no = nomor dokumen asal
   * (PO/nomor dokumen untuk masuk, nomor surat jalan untuk keluar). Pencarian: nama, SKU, atau nomor kiriman.
   */
  listMoves: async (
    ex: Executor,
    o: { clientId: string; direction?: "IN" | "OUT"; search?: string; limit: number; offset: number },
  ) => {
    const term = o.search?.trim().replace(/[\\%_]/g, (c) => "\\" + c);
    const where = and(
      eq(titipanMoves.clientId, o.clientId),
      o.direction ? eq(titipanMoves.direction, o.direction) : undefined,
      term
        ? or(
            ilike(products.name, "%" + term + "%"),
            ilike(products.sku, "%" + term + "%"),
            ilike(titipanMoves.docNo, "%" + term + "%"),
          )
        : undefined,
    );
    const joined = ex
      .select({
        id: titipanMoves.id,
        direction: titipanMoves.direction,
        quantity: titipanMoves.quantity,
        doc_no: titipanMoves.docNo,
        doc_date: titipanMoves.docDate,
        notes: titipanMoves.notes,
        created_at: titipanMoves.createdAt,
        sku: products.sku,
        name: products.name,
        unit: products.unit,
        ref_no: sql<string | null>`coalesce(${pengadaanReceipts.poNumber}, ${pengadaanIssues.poNumber})`,
      })
      .from(titipanMoves)
      .innerJoin(products, eq(products.id, titipanMoves.productId))
      .leftJoin(pengadaanReceipts, and(eq(titipanMoves.direction, "IN"), eq(pengadaanReceipts.receiptNo, titipanMoves.docNo)))
      .leftJoin(pengadaanIssues, and(eq(titipanMoves.direction, "OUT"), eq(pengadaanIssues.issueNo, titipanMoves.docNo)))
      .where(where);
    const [{ total }] = await ex
      .select({ total: count() })
      .from(titipanMoves)
      .innerJoin(products, eq(products.id, titipanMoves.productId))
      .where(where);
    const items = await joined
      .orderBy(desc(titipanMoves.docDate), desc(titipanMoves.createdAt), desc(titipanMoves.id))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
  /** Ringkasan stok titipan per klien (jumlah jenis barang, total masuk/keluar). */
  stockTotalsByClient: (ex: Executor) =>
    ex
      .select({
        client_id: titipanMoves.clientId,
        items: sql<number>`count(distinct ${titipanMoves.productId})::int`,
        masuk: sql<number>`coalesce(sum(case when ${titipanMoves.direction} = 'IN' then ${titipanMoves.quantity} else 0 end), 0)::int`,
        keluar: sql<number>`coalesce(sum(case when ${titipanMoves.direction} = 'OUT' then ${titipanMoves.quantity} else 0 end), 0)::int`,
      })
      .from(titipanMoves)
      .groupBy(titipanMoves.clientId),
  /** Tagihan belum dibayar per klien. */
  upcomingByClient: (ex: Executor, today: string) =>
    ex
      .select({
        client_id: pengadaanInvoices.clientId,
        count: count(),
        total: sql<number>`coalesce(sum(${pengadaanInvoices.totalAmount}), 0)::bigint`,
        overdue: sql<number>`(count(*) filter (where ${pengadaanInvoices.dueDate} < ${today}))::int`,
      })
      .from(pengadaanInvoices)
      .where(eq(pengadaanInvoices.status, "MENDATANG"))
      .groupBy(pengadaanInvoices.clientId),
};
