"use client";

/**
 * Mode demo (NEXT_PUBLIC_DEMO=1): meniru API di browser dengan data contoh di localStorage.
 * Tidak ada database dan tidak ada data nyata. Aturan bisnis utama sama dengan versi server.
 */
import { calculateSubtotal, jakartaDayRange, PRICE_BELOW_COST_MESSAGE } from "./calculations";
import { ApiError } from "./client";

type Role = "ADMIN" | "STAFF";
interface DUser { id: string; email: string; name: string; role: Role; password: string }
interface DProduct { id: string; sku: string; name: string; unit: string; cost_price: number; selling_price: number; current_stock: number; deleted: boolean }
interface DItem { id: string; product_id: string; sku: string; name: string; unit: string; quantity: number; cost_price_at_sale: number; selling_price_at_sale: number; subtotal: number }
interface DSale { id: string; invoice_number: string; user_id: string; cashier_name: string; total_amount: number; status: "COMPLETED" | "CANCELLED"; payment_method: "CASH" | "TRANSFER"; notes: string | null; created_at: string; items: DItem[] }
interface DAdj { id: string; product_id: string; product_name: string; sku: string; user_id: string; user_name: string; type: "IN" | "OUT" | "ADJUSTMENT"; quantity: number; notes: string; created_at: string }
interface Store { users: DUser[]; products: DProduct[]; sales: DSale[]; adjustments: DAdj[]; session: { userId: string } | null }

const KEY = "adzkia-demo-v1";
const uid = () => crypto.randomUUID();

function seed(): Store {
  const p = (sku: string, name: string, unit: string, cost: number, price: number, stock: number): DProduct => ({
    id: uid(), sku, name, unit, cost_price: cost, selling_price: price, current_stock: stock, deleted: false,
  });
  return {
    users: [
      { id: uid(), email: "admin@demo.id", name: "Pemilik Toko", role: "ADMIN", password: "demo1234" },
      { id: uid(), email: "kasir@demo.id", name: "Kasir Demo", role: "STAFF", password: "demo1234" },
    ],
    products: [
      p("SRG-001", "Baju Satpam Lengan Pendek", "pcs", 85000, 125000, 24),
      p("SRG-002", "Celana Satpam Hitam", "pcs", 75000, 110000, 18),
      p("TPI-001", "Topi Satpam Baret", "pcs", 20000, 35000, 40),
      p("SPT-001", "Sepatu PDL Satpam", "pasang", 140000, 210000, 3),
      p("ATR-001", "Ikat Pinggang Satpam", "pcs", 18000, 30000, 30),
      p("ATR-002", "Papan Nama Satpam", "pcs", 6000, 15000, 0),
      p("ATR-003", "Peluit dan Tali", "set", 9000, 18000, 55),
    ],
    sales: [],
    adjustments: [],
    session: null,
  };
}

function load(): Store {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch { /* abaikan */ }
  const s = seed();
  save(s);
  return s;
}
function save(s: Store) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* abaikan */ }
}

export function demoSession(): { name: string; role: Role } | null {
  const s = load();
  const u = s.users.find((x) => x.id === s.session?.userId);
  return u ? { name: u.name, role: u.role } : null;
}

const fail = (status: number, code: string, message: string, errors?: Record<string, string>) =>
  new ApiError(message, status, code, errors);

function page<T>(items: T[], q: URLSearchParams, defaultLimit = 20) {
  const pg = Math.max(1, Number(q.get("page")) || 1);
  const limit = Math.min(100, Math.max(1, Number(q.get("limit")) || defaultLimit));
  return {
    items: items.slice((pg - 1) * limit, pg * limit),
    total: items.length,
    page: pg,
    limit,
    totalPages: Math.max(1, Math.ceil(items.length / limit)),
  };
}

const toDto = (p: DProduct, role: Role) => {
  const { deleted: _d, cost_price, ...rest } = p;
  void _d;
  return role === "ADMIN" ? { ...rest, cost_price } : rest;
};

const today = () => new Date().toISOString();

export async function demoApi(path: string, method: string, body: unknown): Promise<unknown> {
  await new Promise((r) => setTimeout(r, 120));
  const [pathname, qs = ""] = path.split("?");
  const q = new URLSearchParams(qs);
  const st = load();
  const me = st.users.find((u) => u.id === st.session?.userId) ?? null;
  const b = (body ?? {}) as Record<string, unknown>;

  if (pathname === "/api/auth/login") {
    const u = st.users.find((x) => x.email === String(b.email ?? "").trim().toLowerCase() && x.password === b.password);
    if (!u) throw fail(401, "INVALID_CREDENTIALS", "Email atau password salah");
    st.session = { userId: u.id };
    save(st);
    return { user: { id: u.id, name: u.name, role: u.role } };
  }
  if (pathname === "/api/auth/logout") {
    st.session = null;
    save(st);
    return null;
  }
  if (!me) throw fail(401, "UNAUTHORIZED", "Silakan login terlebih dahulu");
  const admin = me.role === "ADMIN";
  const onlyAdmin = () => { if (!admin) throw fail(403, "FORBIDDEN", "Anda tidak berhak mengakses ini"); };

  /* ---------------- produk */
  if (pathname === "/api/products" && method === "GET") {
    const term = (q.get("search") ?? "").toLowerCase();
    const list = st.products
      .filter((p) => !p.deleted && (!term || p.name.toLowerCase().includes(term) || p.sku.toLowerCase().includes(term)))
      .sort((a, b2) => a.name.localeCompare(b2.name));
    const r = page(list, q);
    return { ...r, items: r.items.map((p) => toDto(p, me.role)) };
  }
  if (pathname === "/api/products" && method === "POST") {
    onlyAdmin();
    const sku = String(b.sku ?? "").trim();
    const errors: Record<string, string> = {};
    if (!sku) errors.sku = "SKU wajib diisi";
    if (!String(b.name ?? "").trim()) errors.name = "Nama produk wajib diisi";
    if (Object.keys(errors).length) throw fail(400, "VALIDATION_ERROR", "Input tidak valid", errors);
    const cost = Number(b.cost_price), price = Number(b.selling_price);
    if (price < cost) throw fail(400, "PRICE_BELOW_COST", PRICE_BELOW_COST_MESSAGE, { selling_price: PRICE_BELOW_COST_MESSAGE });
    if (st.products.some((p) => !p.deleted && p.sku.toLowerCase() === sku.toLowerCase())) {
      throw fail(409, "SKU_ALREADY_EXISTS", "SKU sudah dipakai produk lain", { sku: "SKU sudah dipakai produk lain" });
    }
    const p: DProduct = { id: uid(), sku, name: String(b.name).trim(), unit: String(b.unit || "pcs"), cost_price: cost, selling_price: price, current_stock: Math.max(0, Number(b.current_stock) || 0), deleted: false };
    st.products.push(p);
    save(st);
    return toDto(p, me.role);
  }
  const pm = pathname.match(/^\/api\/products\/([^/]+)$/);
  if (pm) {
    onlyAdmin();
    const p = st.products.find((x) => x.id === pm[1] && !x.deleted);
    if (!p) throw fail(404, "NOT_FOUND", "Produk tidak ditemukan");
    if (method === "DELETE") { p.deleted = true; save(st); return null; }
    const cost = b.cost_price !== undefined ? Number(b.cost_price) : p.cost_price;
    const price = b.selling_price !== undefined ? Number(b.selling_price) : p.selling_price;
    if (price < cost) throw fail(400, "PRICE_BELOW_COST", PRICE_BELOW_COST_MESSAGE, { selling_price: PRICE_BELOW_COST_MESSAGE });
    const sku = b.sku !== undefined ? String(b.sku).trim() : p.sku;
    if (st.products.some((x) => x.id !== p.id && !x.deleted && x.sku.toLowerCase() === sku.toLowerCase())) {
      throw fail(409, "SKU_ALREADY_EXISTS", "SKU sudah dipakai produk lain", { sku: "SKU sudah dipakai produk lain" });
    }
    Object.assign(p, { sku, name: b.name !== undefined ? String(b.name).trim() : p.name, unit: b.unit !== undefined ? String(b.unit) : p.unit, cost_price: cost, selling_price: price });
    save(st);
    return toDto(p, me.role);
  }

  /* ---------------- stok */
  if (pathname === "/api/stock-adjustments" && method === "GET") {
    return page([...st.adjustments].sort((a, b2) => b2.created_at.localeCompare(a.created_at)), q);
  }
  if (pathname === "/api/stock-adjustments" && method === "POST") {
    const p = st.products.find((x) => x.id === b.product_id && !x.deleted);
    const errors: Record<string, string> = {};
    if (!p) errors.product_id = "Pilih produk";
    const qty = Number(b.quantity);
    if (!Number.isInteger(qty) || qty < 1) errors.quantity = "Kuantitas harus lebih dari 0";
    if (!String(b.notes ?? "").trim()) errors.notes = "Catatan alasan wajib diisi";
    if (Object.keys(errors).length || !p) throw fail(400, "VALIDATION_ERROR", "Input tidak valid", errors);
    const type = b.type as DAdj["type"];
    let notes = String(b.notes).trim();
    if (type === "IN") p.current_stock += qty;
    else if (type === "OUT") {
      if (qty > p.current_stock) throw fail(409, "INSUFFICIENT_STOCK", "Jumlah penyesuaian keluar melebihi stok yang tersedia saat ini");
      p.current_stock -= qty;
    } else {
      notes += " (stok sistem " + p.current_stock + " menjadi " + qty + ")";
      p.current_stock = qty;
    }
    st.adjustments.push({ id: uid(), product_id: p.id, product_name: p.name, sku: p.sku, user_id: me.id, user_name: me.name, type, quantity: qty, notes, created_at: today() });
    save(st);
    return { current_stock: p.current_stock };
  }

  /* ---------------- penjualan */
  if (pathname === "/api/sales/daily-summary") {
    const { start, end } = jakartaDayRange(q.get("date") ?? new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
    const done = st.sales.filter((s) => s.status === "COMPLETED" && new Date(s.created_at) >= start && new Date(s.created_at) < end);
    const profit = done.reduce((a, s) => a + s.items.reduce((x, i) => x + (i.selling_price_at_sale - i.cost_price_at_sale) * i.quantity, 0), 0);
    return {
      date: start.toISOString().slice(0, 10),
      total_sales_count: done.length,
      total_revenue: done.reduce((a, s) => a + s.total_amount, 0),
      total_profit: admin ? profit : 0,
    };
  }
  if (pathname === "/api/sales" && method === "GET") {
    const from = q.get("from") ? jakartaDayRange(q.get("from")!).start : null;
    const to = q.get("to") ? jakartaDayRange(q.get("to")!).end : null;
    const list = st.sales
      .filter((s) => (!from || new Date(s.created_at) >= from) && (!to || new Date(s.created_at) < to))
      .sort((a, b2) => b2.created_at.localeCompare(a.created_at));
    const r = page(list, q);
    return {
      ...r,
      items: r.items.map((s) => ({
        id: s.id, invoice_number: s.invoice_number, user_id: s.user_id, total_amount: s.total_amount, status: s.status,
        payment_method: s.payment_method, notes: s.notes, created_at: s.created_at, cashier_name: s.cashier_name,
        item_count: s.items.reduce((a, i) => a + i.quantity, 0),
        ...(admin ? { gross_profit: s.items.reduce((a, i) => a + (i.selling_price_at_sale - i.cost_price_at_sale) * i.quantity, 0) } : {}),
      })),
    };
  }
  if (pathname === "/api/sales" && method === "POST") {
    const raw = (b.items ?? []) as { product_id: string; quantity: number }[];
    if (!raw.length) throw fail(400, "VALIDATION_ERROR", "Keranjang masih kosong");
    const want = new Map<string, number>();
    for (const it of raw) want.set(it.product_id, (want.get(it.product_id) ?? 0) + Number(it.quantity));
    const lines: DItem[] = [];
    for (const [id, qty] of want) {
      const p = st.products.find((x) => x.id === id && !x.deleted);
      if (!p) throw fail(404, "NOT_FOUND", "Produk tidak ditemukan atau sudah dihapus");
      if (qty > p.current_stock) throw fail(409, "STOCK_INSUFFICIENT", "Stok tidak mencukupi untuk " + p.sku + ". Sisa stok: " + p.current_stock);
      lines.push({ id: uid(), product_id: p.id, sku: p.sku, name: p.name, unit: p.unit, quantity: qty, cost_price_at_sale: p.cost_price, selling_price_at_sale: p.selling_price, subtotal: calculateSubtotal(p.selling_price, qty) });
    }
    for (const l of lines) st.products.find((x) => x.id === l.product_id)!.current_stock -= l.quantity;
    const sale: DSale = {
      id: uid(),
      invoice_number: "INV-" + new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10).replaceAll("-", "") + "-" + Math.random().toString(16).slice(2, 8).toUpperCase(),
      user_id: me.id, cashier_name: me.name, total_amount: lines.reduce((a, l) => a + l.subtotal, 0), status: "COMPLETED",
      payment_method: b.payment_method === "TRANSFER" ? "TRANSFER" : "CASH", notes: (b.notes as string) || null, created_at: today(), items: lines,
    };
    st.sales.push(sale);
    save(st);
    return sale;
  }
  const cm = pathname.match(/^\/api\/sales\/([^/]+)\/cancel$/);
  if (cm) {
    onlyAdmin();
    const s = st.sales.find((x) => x.id === cm[1]);
    if (!s) throw fail(404, "NOT_FOUND", "Transaksi tidak ditemukan");
    if (s.status === "CANCELLED") throw fail(409, "ALREADY_CANCELLED", "Transaksi sudah dibatalkan sebelumnya");
    for (const i of s.items) { const p = st.products.find((x) => x.id === i.product_id); if (p) p.current_stock += i.quantity; }
    s.status = "CANCELLED";
    save(st);
    return s;
  }
  const sm = pathname.match(/^\/api\/sales\/([^/]+)$/);
  if (sm) {
    const s = st.sales.find((x) => x.id === sm[1]);
    if (!s) throw fail(404, "NOT_FOUND", "Transaksi tidak ditemukan");
    return { ...s, items: s.items.map((i) => { if (admin) return i; const { cost_price_at_sale: _c, ...rest } = i; void _c; return rest; }) };
  }

  /* ---------------- staf */
  if (pathname === "/api/users" && method === "GET") {
    onlyAdmin();
    return page(st.users.map(({ password: _p, ...u }) => (void _p, u)), q, 100);
  }
  if (pathname === "/api/users" && method === "POST") {
    onlyAdmin();
    const errors: Record<string, string> = {};
    const email = String(b.email ?? "").trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.email = "Email tidak valid";
    if (!String(b.name ?? "").trim()) errors.name = "Nama wajib diisi";
    if (String(b.password ?? "").length < 8) errors.password = "Password minimal 8 karakter";
    if (Object.keys(errors).length) throw fail(400, "VALIDATION_ERROR", "Input tidak valid", errors);
    if (st.users.some((u) => u.email === email)) throw fail(409, "DUPLICATE", "Email sudah terdaftar", { email: "Email sudah terdaftar" });
    st.users.push({ id: uid(), email, name: String(b.name).trim(), role: b.role === "ADMIN" ? "ADMIN" : "STAFF", password: String(b.password) });
    save(st);
    return null;
  }

  throw fail(404, "NOT_FOUND", "Endpoint demo tidak tersedia");
}
