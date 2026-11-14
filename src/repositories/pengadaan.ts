import { and, asc, count, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { schema, type Executor, type Tx } from "@/db";

const { users, products, pengadaanReceipts, pengadaanInvoices } = schema;

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
  listInvoices: async (ex: Executor, o: { limit: number; offset: number; status?: InvoiceStatus }) => {
    const where = o.status ? eq(pengadaanInvoices.status, o.status) : undefined;
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
  upcomingAggregate: async (ex: Executor, today: string) => {
    const [row] = await ex
      .select({
        count: count(),
        total: sql<number>`coalesce(sum(${pengadaanInvoices.totalAmount}), 0)::bigint`,
        nearestDue: sql<string | null>`min(${pengadaanInvoices.dueDate})`,
        overdue: sql<number>`(count(*) filter (where ${pengadaanInvoices.dueDate} < ${today}))::int`,
      })
      .from(pengadaanInvoices)
      .where(eq(pengadaanInvoices.status, "MENDATANG"));
    return row;
  },
};
