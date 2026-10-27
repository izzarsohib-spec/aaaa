import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const userRole = pgEnum("UserRole", ["ADMIN", "STAFF"]);
export const stockAdjustmentType = pgEnum("StockAdjustmentType", ["IN", "OUT", "ADJUSTMENT"]);
export const saleStatus = pgEnum("SaleStatus", ["COMPLETED", "CANCELLED"]);
export const paymentMethod = pgEnum("PaymentMethod", ["CASH", "TRANSFER"]);
export const orderStatus = pgEnum("OrderStatus", [
  "MENUNGGU_PEMBAYARAN",
  "MENUNGGU_KONFIRMASI",
  "DIPROSES",
  "DIKIRIM",
  "SELESAI",
  "DIBATALKAN",
]);

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// Semua FK: ON DELETE RESTRICT ON UPDATE CASCADE
const fk = { onDelete: "restrict", onUpdate: "cascade" } as const;

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: userRole("role").notNull().default("STAFF"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const products = pgTable(
  "products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    unit: text("unit").notNull().default("pcs"),
    costPrice: integer("cost_price").notNull().default(0),
    sellingPrice: integer("selling_price").notNull().default(0),
    currentStock: integer("current_stock").notNull().default(0),
    category: text("category").notNull().default("Lainnya"),
    description: text("description"),
    imageUrl: text("image_url"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [
    // SKU unik (case-insensitive) hanya untuk baris aktif
    uniqueIndex("products_sku_active_uq")
      .on(sql`lower(${t.sku})`)
      .where(sql`${t.deletedAt} IS NULL`),
    index("products_deleted_at_idx").on(t.deletedAt),
    index("products_name_idx").on(t.name.asc()),
    index("products_category_idx").on(t.category),
    check("products_cost_price_nonneg", sql`${t.costPrice} >= 0`),
    check("products_price_gte_cost", sql`${t.sellingPrice} >= ${t.costPrice}`),
    check("products_stock_nonneg", sql`${t.currentStock} >= 0`),
  ],
);

export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, fk),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, fk),
    type: stockAdjustmentType("type").notNull().default("IN"),
    quantity: integer("quantity").notNull(),
    notes: text("notes").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("stock_adjustments_product_id_idx").on(t.productId, t.createdAt),
    index("stock_adjustments_user_id_idx").on(t.userId),
    check("stock_adjustments_qty_pos", sql`${t.quantity} > 0`),
  ],
);

export const sales = pgTable(
  "sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, fk),
    totalAmount: integer("total_amount").notNull().default(0),
    status: saleStatus("status").notNull().default("COMPLETED"),
    paymentMethod: paymentMethod("payment_method").notNull().default("CASH"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sales_user_id_idx").on(t.userId),
    index("sales_status_created_idx").on(t.status, t.createdAt),
    check("sales_total_nonneg", sql`${t.totalAmount} >= 0`),
  ],
);

export const saleItems = pgTable(
  "sale_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    saleId: uuid("sale_id")
      .notNull()
      .references(() => sales.id, fk),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, fk),
    quantity: integer("quantity").notNull(),
    costPriceAtSale: integer("cost_price_at_sale").notNull(),
    sellingPriceAtSale: integer("selling_price_at_sale").notNull(),
    subtotal: integer("subtotal").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("sale_items_sale_id_idx").on(t.saleId),
    index("sale_items_product_id_idx").on(t.productId),
    check("sale_items_qty_pos", sql`${t.quantity} > 0`),
    check("sale_items_subtotal_nonneg", sql`${t.subtotal} >= 0`),
  ],
);

export type User = typeof users.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Sale = typeof sales.$inferSelect;

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderNumber: text("order_number").notNull().unique(),
    customerName: text("customer_name").notNull(),
    phone: text("phone").notNull(),
    address: text("address").notNull(),
    city: text("city").notNull(),
    postalCode: text("postal_code"),
    shippingMethod: text("shipping_method").notNull(),
    shippingCost: integer("shipping_cost").notNull().default(0),
    subtotal: integer("subtotal").notNull().default(0),
    totalAmount: integer("total_amount").notNull().default(0),
    status: orderStatus("status").notNull().default("MENUNGGU_PEMBAYARAN"),
    notes: text("notes"),
    trackingNumber: text("tracking_number"),
    saleId: uuid("sale_id").references(() => sales.id, fk),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_status_created_idx").on(t.status, t.createdAt),
    index("orders_sale_id_idx").on(t.saleId),
    check("orders_amounts_nonneg", sql`${t.shippingCost} >= 0 AND ${t.subtotal} >= 0 AND ${t.totalAmount} >= 0`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, fk),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, fk),
    sku: text("sku").notNull(),
    name: text("name").notNull(),
    quantity: integer("quantity").notNull(),
    unitPrice: integer("unit_price").notNull(),
    unitCost: integer("unit_cost").notNull(),
    subtotal: integer("subtotal").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("order_items_order_id_idx").on(t.orderId),
    index("order_items_product_id_idx").on(t.productId),
    check("order_items_qty_pos", sql`${t.quantity} > 0`),
  ],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, fk),
    status: orderStatus("status").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_id_idx").on(t.orderId, t.createdAt)],
);
