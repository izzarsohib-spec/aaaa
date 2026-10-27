import { and, asc, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { schema, type Executor, type Tx } from "@/db";

const { products, orders, orderItems, orderEvents } = schema;

type OrderStatus = (typeof orders.$inferSelect)["status"];

const likeEscape = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);

const shopSort = {
  newest: [desc(products.createdAt)],
  price_asc: [asc(products.sellingPrice)],
  price_desc: [desc(products.sellingPrice)],
  name: [asc(products.name)],
} as const;
export const SHOP_SORTS = Object.keys(shopSort);

/** Kolom publik produk: TANPA cost_price. */
const shopColumns = {
  id: products.id,
  sku: products.sku,
  name: products.name,
  unit: products.unit,
  category: products.category,
  description: products.description,
  image_url: products.imageUrl,
  selling_price: products.sellingPrice,
  current_stock: products.currentStock,
};

export const shopRepo = {
  list: async (
    ex: Executor,
    o: { limit: number; offset: number; search: string; category?: string; sort: string; inStockOnly: boolean },
  ) => {
    const term = "%" + likeEscape(o.search) + "%";
    const where = and(
      isNull(products.deletedAt),
      o.category ? eq(products.category, o.category) : undefined,
      o.inStockOnly ? sql`${products.currentStock} > 0` : undefined,
      o.search ? or(ilike(products.name, term), ilike(products.sku, term)) : undefined,
    );
    const order = shopSort[o.sort as keyof typeof shopSort] ?? shopSort.newest;
    const [{ total }] = await ex.select({ total: count() }).from(products).where(where);
    const items = await ex
      .select(shopColumns)
      .from(products)
      .where(where)
      .orderBy(...order, asc(products.id))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
  find: async (ex: Executor, id: string) => {
    const [row] = await ex.select(shopColumns).from(products).where(and(eq(products.id, id), isNull(products.deletedAt)));
    return row ?? null;
  },
};

export const orderRepo = {
  insert: async (tx: Tx, v: typeof orders.$inferInsert) => {
    const [row] = await tx.insert(orders).values(v).returning();
    return row;
  },
  insertItems: async (tx: Tx, rows: (typeof orderItems.$inferInsert)[]) => {
    await tx.insert(orderItems).values(rows);
  },
  addEvent: async (tx: Tx, orderId: string, status: OrderStatus) => {
    await tx.insert(orderEvents).values({ orderId, status });
  },
  lockById: async (tx: Tx, id: string) => {
    const [row] = await tx.select().from(orders).where(eq(orders.id, id)).for("update");
    return row ?? null;
  },
  lockByNumber: async (tx: Tx, orderNumber: string) => {
    const [row] = await tx.select().from(orders).where(eq(orders.orderNumber, orderNumber)).for("update");
    return row ?? null;
  },
  findByNumber: async (ex: Executor, orderNumber: string) => {
    const [row] = await ex.select().from(orders).where(eq(orders.orderNumber, orderNumber));
    return row ?? null;
  },
  findById: async (ex: Executor, id: string) => {
    const [row] = await ex.select().from(orders).where(eq(orders.id, id));
    return row ?? null;
  },
  itemsOf: (ex: Executor, orderId: string) =>
    ex.select().from(orderItems).where(eq(orderItems.orderId, orderId)).orderBy(asc(orderItems.createdAt), asc(orderItems.id)),
  eventsOf: (ex: Executor, orderId: string) =>
    ex.select().from(orderEvents).where(eq(orderEvents.orderId, orderId)).orderBy(asc(orderEvents.createdAt), asc(orderEvents.id)),
  update: async (tx: Tx, id: string, v: Partial<typeof orders.$inferInsert>) => {
    const [row] = await tx.update(orders).set(v).where(eq(orders.id, id)).returning();
    return row;
  },
  list: async (ex: Executor, o: { limit: number; offset: number; status?: OrderStatus }) => {
    const where = o.status ? eq(orders.status, o.status) : undefined;
    const [{ total }] = await ex.select({ total: count() }).from(orders).where(where);
    const items = await ex
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt), desc(orders.id))
      .limit(o.limit)
      .offset(o.offset);
    return { items, total };
  },
};
