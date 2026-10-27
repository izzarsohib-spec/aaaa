import { and, asc, count, desc, eq, gte, ilike, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { getDb, schema, type Executor, type Tx } from "@/db";

const { users, products, stockAdjustments, sales, saleItems } = schema;

/** Satu-satunya pintu transaksi untuk service (service tidak menyentuh ORM langsung). */
export function runInTransaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getDb().transaction(fn);
}
export const db = (): Executor => getDb();

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

/* ------------------------------------------------------------------ users */
const userColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  createdAt: users.createdAt,
};

export const userRepo = {
  /** Satu-satunya query yang membaca password_hash (untuk verifikasi login). */
  findForLogin: async (ex: Executor, email: string) => {
    const [row] = await ex
      .select({ id: users.id, name: users.name, role: users.role, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email));
    return row ?? null;
  },
  list: async (ex: Executor, o: { limit: number; offset: number; search: string }) => {
    const where = o.search
      ? or(ilike(users.name, "%" + likeEscape(o.search) + "%"), ilike(users.email, "%" + likeEscape(o.search) + "%"))
      : undefined;
    const [{ total }] = await ex.select({ total: count() }).from(users).where(where);
    const items = await ex.select(userColumns).from(users).where(where).orderBy(asc(users.name)).limit(o.limit).offset(o.offset);
    return { items, total };
  },
  insert: async (ex: Executor, v: { email: string; name: string; role: "ADMIN" | "STAFF"; passwordHash: string }) => {
    const [row] = await ex.insert(users).values(v).returning(userColumns);
    return row;
  },
};

/* --------------------------------------------------------------- products */
const productSort = {
  name: products.name,
  sku: products.sku,
  selling_price: products.sellingPrice,
  current_stock: products.currentStock,
  created_at: products.createdAt,
} as const;
export const PRODUCT_SORTABLE = Object.keys(productSort);

export const productRepo = {
  list: async (
    ex: Executor,
    o: { limit: number; offset: number; search: string; sortBy: string; sortOrder: "asc" | "desc" },
  ) => {
    const term = "%" + likeEscape(o.search) + "%";
    const where = and(
      isNull(products.deletedAt),
      o.search ? or(ilike(products.name, term), ilike(products.sku, term)) : undefined,
    );
    const col = productSort[o.sortBy as keyof typeof productSort] ?? products.name;
    const [{ total }] = await ex.select({ total: count() }).from(products).where(where);
    const items = await ex
      .select()
      .from(products)
      .where(where)
      .orderBy(o.sortOrder === "desc" ? desc(col) : asc(col), asc(products.id))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
  findActive: async (ex: Executor, id: string) => {
    const [row] = await ex.select().from(products).where(and(eq(products.id, id), isNull(products.deletedAt)));
    return row ?? null;
  },
  /** Kunci baris (SELECT ... FOR UPDATE), urut id supaya tidak deadlock. */
  lockByIds: (tx: Tx, ids: string[]) =>
    tx.select().from(products).where(inArray(products.id, ids)).orderBy(asc(products.id)).for("update"),
  lockActiveById: async (tx: Tx, id: string) => {
    const [row] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .for("update");
    return row ?? null;
  },
  skuTaken: async (ex: Executor, sku: string, excludeId?: string) => {
    const [row] = await ex
      .select({ id: products.id })
      .from(products)
      .where(
        and(
          sql`lower(${products.sku}) = lower(${sku})`,
          isNull(products.deletedAt),
          excludeId ? sql`${products.id} <> ${excludeId}` : undefined,
        ),
      );
    return Boolean(row);
  },
  insert: async (ex: Executor, v: typeof products.$inferInsert) => {
    const [row] = await ex.insert(products).values(v).returning();
    return row;
  },
  update: async (ex: Executor, id: string, v: Partial<typeof products.$inferInsert>) => {
    const [row] = await ex.update(products).set(v).where(and(eq(products.id, id), isNull(products.deletedAt))).returning();
    return row ?? null;
  },
  setStock: async (tx: Tx, id: string, stock: number) => {
    await tx.update(products).set({ currentStock: stock }).where(eq(products.id, id));
  },
  softDelete: async (ex: Executor, id: string) => {
    const [row] = await ex
      .update(products)
      .set({ deletedAt: new Date() })
      .where(and(eq(products.id, id), isNull(products.deletedAt)))
      .returning({ id: products.id });
    return Boolean(row);
  },
  usedInSales: async (ex: Executor, id: string) => {
    const [{ n }] = await ex.select({ n: count() }).from(saleItems).where(eq(saleItems.productId, id));
    return n > 0;
  },
};

/* ------------------------------------------------------ stock adjustments */
export const stockRepo = {
  insert: async (tx: Tx, v: typeof stockAdjustments.$inferInsert) => {
    const [row] = await tx.insert(stockAdjustments).values(v).returning();
    return row;
  },
  list: async (ex: Executor, o: { limit: number; offset: number; productId?: string }) => {
    const where = o.productId ? eq(stockAdjustments.productId, o.productId) : undefined;
    const [{ total }] = await ex.select({ total: count() }).from(stockAdjustments).where(where);
    const items = await ex
      .select({
        id: stockAdjustments.id,
        product_id: stockAdjustments.productId,
        product_name: products.name,
        sku: products.sku,
        user_id: stockAdjustments.userId,
        user_name: users.name,
        type: stockAdjustments.type,
        quantity: stockAdjustments.quantity,
        notes: stockAdjustments.notes,
        created_at: stockAdjustments.createdAt,
      })
      .from(stockAdjustments)
      .innerJoin(products, eq(products.id, stockAdjustments.productId))
      .innerJoin(users, eq(users.id, stockAdjustments.userId))
      .where(where)
      .orderBy(desc(stockAdjustments.createdAt))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
};

/* ------------------------------------------------------------------ sales */
const profitExpr = sql<number>`coalesce(sum((${saleItems.sellingPriceAtSale} - ${saleItems.costPriceAtSale}) * ${saleItems.quantity}), 0)::bigint`;

export const saleRepo = {
  insertSale: async (tx: Tx, v: typeof sales.$inferInsert) => {
    const [row] = await tx.insert(sales).values(v).returning();
    return row;
  },
  insertItems: async (tx: Tx, rows: (typeof saleItems.$inferInsert)[]) => {
    await tx.insert(saleItems).values(rows);
  },
  lockById: async (tx: Tx, id: string) => {
    const [row] = await tx.select().from(sales).where(eq(sales.id, id)).for("update");
    return row ?? null;
  },
  itemsOf: (ex: Executor, saleId: string) =>
    ex
      .select({
        id: saleItems.id,
        product_id: saleItems.productId,
        sku: products.sku,
        name: products.name,
        unit: products.unit,
        quantity: saleItems.quantity,
        cost_price_at_sale: saleItems.costPriceAtSale,
        selling_price_at_sale: saleItems.sellingPriceAtSale,
        subtotal: saleItems.subtotal,
      })
      .from(saleItems)
      .innerJoin(products, eq(products.id, saleItems.productId))
      .where(eq(saleItems.saleId, saleId))
      .orderBy(asc(saleItems.createdAt), asc(saleItems.id)),
  setStatus: async (tx: Tx, id: string, status: "COMPLETED" | "CANCELLED") => {
    const [row] = await tx.update(sales).set({ status }).where(eq(sales.id, id)).returning();
    return row;
  },
  findWithUser: async (ex: Executor, id: string) => {
    const [row] = await ex
      .select({ sale: sales, cashier: users.name })
      .from(sales)
      .innerJoin(users, eq(users.id, sales.userId))
      .where(eq(sales.id, id));
    return row ?? null;
  },
  list: async (ex: Executor, o: { limit: number; offset: number; from?: Date; toExclusive?: Date }) => {
    const where = and(o.from ? gte(sales.createdAt, o.from) : undefined, o.toExclusive ? lt(sales.createdAt, o.toExclusive) : undefined);
    const [{ total }] = await ex.select({ total: count() }).from(sales).where(where);
    const items = await ex
      .select({
        sale: sales,
        cashier: users.name,
        itemCount: sql<number>`coalesce(sum(${saleItems.quantity}), 0)::int`,
        profit: profitExpr,
      })
      .from(sales)
      .innerJoin(users, eq(users.id, sales.userId))
      .leftJoin(saleItems, eq(saleItems.saleId, sales.id))
      .where(where)
      .groupBy(sales.id, users.name)
      .orderBy(desc(sales.createdAt), desc(sales.id))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
  /** Agregasi di database: hanya COMPLETED, laba memakai snapshot item. */
  dailyAggregate: async (ex: Executor, start: Date, endExclusive: Date) => {
    const period = and(eq(sales.status, "COMPLETED"), gte(sales.createdAt, start), lt(sales.createdAt, endExclusive));
    const [head] = await ex
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${sales.totalAmount}), 0)::bigint`,
      })
      .from(sales)
      .where(period);
    const [prof] = await ex
      .select({ profit: profitExpr })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(period);
    return { count: Number(head.count), revenue: Number(head.revenue), profit: Number(prof.profit) };
  },
};
