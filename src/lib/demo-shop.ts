"use client";

/** Bagian demo untuk toko online & pesanan (dipanggil dari demo-api). Meniru aturan layanan server. */
import { calculateSubtotal } from "./calculations";
import type { ApiError } from "./client";
import { SHIPPING, normalizePhone } from "./shop";
import type { Store } from "./demo-api";

type Helpers = {
  st: Store;
  me: { id: string; name: string; role: "ADMIN" | "STAFF" } | null;
  q: URLSearchParams;
  b: Record<string, unknown>;
  method: string;
  save: (s: Store) => void;
  fail: (status: number, code: string, message: string, errors?: Record<string, string>) => ApiError;
  page: <T>(items: T[], q: URLSearchParams, limit?: number) => { items: T[]; total: number; page: number; limit: number; totalPages: number };
};

const NOT_HANDLED = Symbol("not-handled");
export { NOT_HANDLED };

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

function jakartaStamp() {
  return new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replaceAll("-", "");
}

export function demoShop(pathname: string, h: Helpers): unknown {
  const { st, me, q, b, method, save, fail, page } = h;

  const shopDto = (p: Store["products"][number]) => ({
    id: p.id, sku: p.sku, name: p.name, unit: p.unit, category: p.category, description: p.description,
    image_url: p.image_url, selling_price: p.selling_price, current_stock: p.current_stock,
  });

  const detail = (o: Store["orders"][number], admin: boolean) => ({
    id: o.id, order_number: o.order_number, status: o.status, customer_name: o.customer_name,
    address: o.address, city: o.city, postal_code: o.postal_code, shipping_method: o.shipping_method,
    shipping_cost: o.shipping_cost, subtotal: o.subtotal, total_amount: o.total_amount, notes: o.notes,
    tracking_number: o.tracking_number, created_at: o.created_at,
    ...(admin ? { phone: o.phone, sale_id: o.sale_id } : {}),
    items: o.items.map((i) => ({ id: i.id, product_id: i.product_id, sku: i.sku, name: i.name, quantity: i.quantity, unit_price: i.unit_price, subtotal: i.subtotal })),
    events: o.events,
  });

  /* ---------- publik: katalog */
  if (pathname === "/api/shop/products" && method === "GET") {
    const term = (q.get("search") ?? "").toLowerCase();
    const cat = q.get("category");
    const sort = q.get("sortBy") ?? "newest";
    const list = st.products
      .filter((p) => !p.deleted && (!cat || p.category === cat) && (q.get("in_stock") !== "1" || p.current_stock > 0) &&
        (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)))
      .sort((a, c) =>
        sort === "price_asc" ? a.selling_price - c.selling_price
        : sort === "price_desc" ? c.selling_price - a.selling_price
        : sort === "name" ? a.name.localeCompare(c.name)
        : st.products.indexOf(c) - st.products.indexOf(a));
    const r = page(list, q, 20);
    return { ...r, items: r.items.map(shopDto) };
  }
  const pm = pathname.match(/^\/api\/shop\/products\/([^/]+)$/);
  if (pm) {
    const p = st.products.find((x) => x.id === pm[1] && !x.deleted);
    if (!p) throw fail(404, "NOT_FOUND", "Produk tidak ditemukan");
    return shopDto(p);
  }

  /* ---------- publik: pesanan */
  if (pathname === "/api/shop/orders" && method === "POST") {
    const errors: Record<string, string> = {};
    const phone = normalizePhone(String(b.phone ?? ""));
    if (String(b.customer_name ?? "").trim().length < 2) errors.customer_name = "Nama penerima wajib diisi";
    if (!phone) errors.phone = "Nomor WhatsApp tidak valid";
    if (String(b.address ?? "").trim().length < 5) errors.address = "Alamat lengkap wajib diisi";
    if (String(b.city ?? "").trim().length < 2) errors.city = "Kota wajib diisi";
    const ship = SHIPPING.find((s) => s.id === b.shipping_method);
    if (!ship) errors.shipping_method = "Pilih metode pengiriman";
    if (Object.keys(errors).length || !phone || !ship) throw fail(400, "VALIDATION_ERROR", "Input tidak valid", errors);
    const raw = (b.items ?? []) as { product_id: string; quantity: number }[];
    if (!raw.length) throw fail(400, "VALIDATION_ERROR", "Keranjang masih kosong");
    const want = new Map<string, number>();
    for (const it of raw) want.set(it.product_id, (want.get(it.product_id) ?? 0) + Number(it.quantity));
    const items: Store["orders"][number]["items"] = [];
    for (const [id, qty] of want) {
      const p = st.products.find((x) => x.id === id && !x.deleted);
      if (!p) throw fail(404, "NOT_FOUND", "Ada produk yang sudah tidak tersedia");
      if (qty > p.current_stock) throw fail(409, "STOCK_INSUFFICIENT", "Stok tidak mencukupi untuk " + p.name + ". Sisa stok: " + p.current_stock);
      items.push({ id: uid(), product_id: p.id, sku: p.sku, name: p.name, quantity: qty, unit_price: p.selling_price, unit_cost: p.cost_price, subtotal: calculateSubtotal(p.selling_price, qty) });
    }
    for (const i of items) st.products.find((x) => x.id === i.product_id)!.current_stock -= i.quantity;
    const subtotal = items.reduce((a, i) => a + i.subtotal, 0);
    const created = now();
    const order: Store["orders"][number] = {
      id: uid(), order_number: "ORD-" + jakartaStamp() + "-" + Math.random().toString(16).slice(2, 8).toUpperCase(),
      status: "MENUNGGU_PEMBAYARAN", customer_name: String(b.customer_name).trim(), phone, address: String(b.address).trim(),
      city: String(b.city).trim(), postal_code: String(b.postal_code ?? "").trim() || null, shipping_method: ship.label,
      shipping_cost: ship.cost, subtotal, total_amount: subtotal + ship.cost, notes: String(b.notes ?? "").trim() || null,
      tracking_number: null, sale_id: null, created_at: created, items, events: [{ status: "MENUNGGU_PEMBAYARAN", created_at: created }],
    };
    st.orders.push(order);
    save(st);
    return detail(order, false);
  }
  if (pathname === "/api/shop/orders/lookup" || pathname === "/api/shop/orders/pay") {
    const o = st.orders.find((x) => x.order_number === String(b.order_number ?? "").toUpperCase());
    if (!o || o.phone !== normalizePhone(String(b.phone ?? ""))) throw fail(404, "NOT_FOUND", "Pesanan tidak ditemukan. Periksa nomor pesanan dan nomor WhatsApp.");
    if (pathname.endsWith("/pay")) {
      if (o.status !== "MENUNGGU_PEMBAYARAN") throw fail(409, "INVALID_TRANSITION", "Status pesanan tidak memungkinkan tindakan ini");
      o.status = "MENUNGGU_KONFIRMASI";
      o.events.push({ status: o.status, created_at: now() });
      save(st);
    }
    return detail(o, false);
  }

  /* ---------- admin: pesanan */
  if (pathname === "/api/orders" || pathname.startsWith("/api/orders/")) {
    if (!me) throw fail(401, "UNAUTHORIZED", "Silakan login terlebih dahulu");
    if (pathname === "/api/orders") {
      const status = q.get("status");
      const list = st.orders.filter((o) => !status || o.status === status).sort((a, c) => c.created_at.localeCompare(a.created_at));
      const r = page(list, q, 10);
      return {
        ...r,
        items: r.items.map((o) => ({
          id: o.id, order_number: o.order_number, status: o.status, customer_name: o.customer_name, phone: o.phone, city: o.city,
          total_amount: o.total_amount, shipping_method: o.shipping_method, tracking_number: o.tracking_number, created_at: o.created_at,
        })),
      };
    }
    const o = st.orders.find((x) => x.id === pathname.split("/")[3]);
    if (!o) throw fail(404, "NOT_FOUND", "Pesanan tidak ditemukan");
    if (method === "GET") return detail(o, true);

    const action = String(b.action ?? "");
    const bad = () => fail(409, "INVALID_TRANSITION", "Status pesanan tidak memungkinkan tindakan ini");
    if (action === "cancel") {
      if (me.role !== "ADMIN") throw fail(403, "FORBIDDEN", "Hanya pemilik yang dapat membatalkan pesanan");
      if (o.status === "SELESAI" || o.status === "DIBATALKAN") throw bad();
      for (const i of o.items) { const p = st.products.find((x) => x.id === i.product_id); if (p) p.current_stock += i.quantity; }
      const s = st.sales.find((x) => x.id === o.sale_id);
      if (s) s.status = "CANCELLED";
      o.status = "DIBATALKAN";
    } else if (action === "confirm_payment") {
      if (o.status !== "MENUNGGU_PEMBAYARAN" && o.status !== "MENUNGGU_KONFIRMASI") throw bad();
      const sale = {
        id: uid(), invoice_number: o.order_number, user_id: me.id, cashier_name: me.name, total_amount: o.subtotal,
        status: "COMPLETED" as const, payment_method: "TRANSFER" as const, notes: "Pesanan online " + o.order_number, created_at: now(),
        items: o.items.map((i) => ({ id: uid(), product_id: i.product_id, sku: i.sku, name: i.name, unit: "pcs", quantity: i.quantity, cost_price_at_sale: i.unit_cost, selling_price_at_sale: i.unit_price, subtotal: i.subtotal })),
      };
      st.sales.push(sale);
      o.sale_id = sale.id;
      o.status = "DIPROSES";
    } else if (action === "ship") {
      if (o.status !== "DIPROSES") throw bad();
      o.status = "DIKIRIM";
      if (b.tracking_number) o.tracking_number = String(b.tracking_number);
    } else if (action === "complete") {
      if (o.status !== "DIKIRIM") throw bad();
      o.status = "SELESAI";
    } else throw fail(400, "VALIDATION_ERROR", "Tindakan tidak valid");
    o.events.push({ status: o.status, created_at: now() });
    save(st);
    return detail(o, true);
  }

  return NOT_HANDLED;
}
