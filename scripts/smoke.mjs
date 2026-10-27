// Smoke test HTTP sesuai PRD. Jalankan setelah `npm run start`: node scripts/smoke.mjs
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@adzkia.local";
const PASS = process.env.SEED_ADMIN_PASSWORD ?? "adzkia-dev-2026";

let failed = 0;
const check = (name, cond, extra = "") => {
  console.log((cond ? "PASS " : "FAIL ") + name + (cond ? "" : "  -> " + extra));
  if (!cond) failed++;
};

function client() {
  const jar = {};
  return async (path, { method = "GET", body, csrf = true, headers = {} } = {}) => {
    const h = { ...headers };
    if (body !== undefined) h["content-type"] = "application/json";
    if (method !== "GET" && csrf && jar.adzkia_csrf) h["x-csrf-token"] = jar.adzkia_csrf;
    h.cookie = Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ");
    const res = await fetch(BASE + path, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual" });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(";");
      const i = kv.indexOf("=");
      const k = kv.slice(0, i);
      const v = kv.slice(i + 1);
      if (/Max-Age=0/i.test(c) || v === "") delete jar[k];
      else jar[k] = v;
    }
    let json = null;
    try { json = await res.json(); } catch { /* bukan JSON */ }
    return { status: res.status, json, headers: res.headers, jar };
  };
}

const admin = client();
const staff = client();
const anon = client();
const suffix = Date.now().toString(36).toUpperCase();
const SKU = "SMK-" + suffix;

// --- akses & login
let r = await anon("/api/products");
check("tanpa login -> 401", r.status === 401 && r.json.success === false && r.json.code === "UNAUTHORIZED");
r = await anon("/api/auth/login", { method: "POST", body: { email: EMAIL, password: "salah-banget" } });
check("login salah -> 401 INVALID_CREDENTIALS", r.status === 401 && r.json.code === "INVALID_CREDENTIALS", JSON.stringify(r.json));
r = await admin("/api/auth/login", { method: "POST", body: { email: EMAIL, password: PASS } });
check("login admin -> 200 + cookie", r.status === 200 && r.jar.adzkia_session && r.jar.adzkia_csrf, JSON.stringify(r.json));
const setCookie = (await fetch(BASE + "/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: PASS }) })).headers.getSetCookie().join("\n");
check("cookie sesi HttpOnly + SameSite=Lax", /adzkia_session=[^;]+;.*HttpOnly/i.test(setCookie) && /SameSite=lax/i.test(setCookie), setCookie);

// --- CSRF
r = await admin("/api/products", { method: "POST", csrf: false, body: { sku: "X", name: "x", cost_price: 1, selling_price: 2 } });
check("POST tanpa token CSRF -> 403", r.status === 403, JSON.stringify(r.json));

// --- produk
r = await admin("/api/products", { method: "POST", body: { sku: "ERR-" + suffix, name: "Barang X", cost_price: 50000, selling_price: 45000, current_stock: 5 } });
check("harga jual < modal -> 400 + pesan PRD", r.status === 400 && r.json.code === "PRICE_BELOW_COST" && r.json.message === "Harga jual tidak boleh lebih kecil dari harga modal (HPP)" && r.json.errors?.selling_price, JSON.stringify(r.json));
r = await admin("/api/products", { method: "POST", body: { sku: SKU, name: "Baju Satpam Smoke", cost_price: 10000, selling_price: 15000, current_stock: 10 } });
check("buat produk -> 201 + Location", r.status === 201 && r.headers.get("location")?.includes(r.json.data.id), JSON.stringify(r.json));
const pid = r.json.data.id;
r = await admin("/api/products", { method: "POST", body: { sku: SKU.toLowerCase(), name: "Dup", cost_price: 1, selling_price: 2 } });
check("SKU duplikat beda huruf -> 409", r.status === 409 && r.json.code === "SKU_ALREADY_EXISTS", JSON.stringify(r.json));

// --- staf
r = await admin("/api/users", { method: "POST", body: { email: "kasir-" + suffix.toLowerCase() + "@adzkia.local", name: "Kasir Smoke", password: "kasir-password-1", role: "STAFF" } });
check("admin buat akun STAFF -> 201, tanpa password_hash", r.status === 201 && !JSON.stringify(r.json).includes("password"), JSON.stringify(r.json));
const staffEmail = r.json.data.email;
r = await staff("/api/auth/login", { method: "POST", body: { email: staffEmail, password: "kasir-password-1" } });
check("login staf", r.status === 200);
r = await staff("/api/products?search=" + SKU);
check("STAFF tidak melihat cost_price", r.status === 200 && r.json.data.items.length === 1 && !("cost_price" in r.json.data.items[0]), JSON.stringify(r.json));
r = await admin("/api/products?search=" + SKU);
check("ADMIN melihat cost_price", r.json.data.items[0].cost_price === 10000);
r = await staff("/api/products", { method: "POST", body: { sku: "S-" + suffix, name: "x", cost_price: 1, selling_price: 2 } });
check("STAFF POST /products -> 403", r.status === 403);
r = await staff("/api/users");
check("STAFF GET /users -> 403", r.status === 403);

// --- stok
r = await admin("/api/stock-adjustments", { method: "POST", body: { product_id: pid, type: "IN", quantity: 5, notes: "kulakan smoke" } });
check("stok IN 5 -> 15", r.status === 201 && r.json.data.current_stock === 15, JSON.stringify(r.json));
r = await admin("/api/stock-adjustments", { method: "POST", body: { product_id: pid, type: "OUT", quantity: 99, notes: "x" } });
check("OUT melebihi stok -> 409 pesan PRD", r.status === 409 && r.json.message === "Jumlah penyesuaian keluar melebihi stok yang tersedia saat ini", JSON.stringify(r.json));
r = await admin("/api/stock-adjustments", { method: "POST", body: { product_id: pid, type: "IN", quantity: 0, notes: "x" } });
check("qty 0 -> 400", r.status === 400 && r.json.errors?.quantity, JSON.stringify(r.json));

// --- kasir
const before = (await admin("/api/sales/daily-summary")).json.data;
r = await staff("/api/sales", { method: "POST", body: { payment_method: "CASH", items: [{ product_id: pid, quantity: 99 }] } });
check("qty > stok -> 409 STOCK_INSUFFICIENT", r.status === 409 && r.json.code === "STOCK_INSUFFICIENT" && r.json.message === "Stok tidak mencukupi untuk " + SKU + ". Sisa stok: 15", JSON.stringify(r.json));
r = await staff("/api/sales", { method: "POST", body: { payment_method: "CASH", items: [{ product_id: pid, quantity: 2 }] } });
check("jual 2 unit -> 201 total 30000", r.status === 201 && r.json.data.total_amount === 30000, JSON.stringify(r.json));
const saleId = r.json.data.id;
r = await admin("/api/products?search=" + SKU);
check("stok menjadi 13", r.json.data.items[0].current_stock === 13);

// --- dashboard
let d = (await admin("/api/sales/daily-summary")).json.data;
check("dashboard ADMIN: omset +30000, laba +10000, trx +1", d.total_revenue - before.total_revenue === 30000 && d.total_profit - before.total_profit === 10000 && d.total_sales_count - before.total_sales_count === 1, JSON.stringify([before, d]));
d = (await staff("/api/sales/daily-summary")).json.data;
check("dashboard STAFF: total_profit = 0", d.total_profit === 0 && d.total_revenue > 0, JSON.stringify(d));
r = await staff("/api/sales?limit=5");
check("riwayat STAFF tanpa gross_profit", r.status === 200 && !("gross_profit" in r.json.data.items[0]));

// --- pembatalan
r = await staff("/api/sales/" + saleId + "/cancel", { method: "PATCH" });
check("STAFF batalkan -> 403", r.status === 403);
r = await admin("/api/sales/" + saleId + "/cancel", { method: "PATCH" });
check("ADMIN batalkan -> 200 CANCELLED", r.status === 200 && r.json.data.status === "CANCELLED", JSON.stringify(r.json));
r = await admin("/api/sales/" + saleId + "/cancel", { method: "PATCH" });
check("batal ulang -> 409 ALREADY_CANCELLED", r.status === 409 && r.json.code === "ALREADY_CANCELLED");
r = await admin("/api/products?search=" + SKU);
check("stok pulih 15", r.json.data.items[0].current_stock === 15);
d = (await admin("/api/sales/daily-summary")).json.data;
check("dashboard kembali seperti semula", d.total_revenue === before.total_revenue && d.total_profit === before.total_profit);

// --- hapus produk
r = await admin("/api/products/" + pid, { method: "DELETE" });
check("soft-delete produk -> 200", r.status === 200);
r = await admin("/api/products?search=" + SKU);
check("produk hilang dari daftar", r.json.data.items.length === 0);
r = await admin("/api/products", { method: "POST", body: { sku: SKU, name: "Pakai ulang SKU", cost_price: 1, selling_price: 2 } });
check("SKU bekas soft-delete boleh dibuat ulang", r.status === 201, JSON.stringify(r.json));

// --- toko online (publik)
r = await anon("/api/shop/products?limit=5");
check("katalog publik tanpa login -> 200, tanpa cost_price", r.status === 200 && r.json.data.items.length > 0 && r.json.data.items.every((i) => !("cost_price" in i)), JSON.stringify(r.json).slice(0, 200));
const shopProduct = (await admin("/api/products", { method: "POST", body: { sku: "SHP-" + suffix, name: "Produk Toko Smoke", category: "Topi", cost_price: 20000, selling_price: 35000, current_stock: 5 } })).json.data;
const phone = "0812" + Date.now().toString().slice(-8);
r = await anon("/api/shop/orders", { method: "POST", body: { customer_name: "Budi Smoke", phone, address: "Jl. Merdeka 1", city: "Semarang", shipping_method: "JNE_REG", items: [{ product_id: shopProduct.id, quantity: 2 }] } });
check("pesanan publik -> 201, total 70000 + ongkir 25000", r.status === 201 && r.json.data.total_amount === 95000 && r.json.data.status === "MENUNGGU_PEMBAYARAN", JSON.stringify(r.json));
const order = r.json.data;
r = await admin("/api/products?search=SHP-" + suffix);
check("stok produk toko terpotong (reservasi)", r.json.data.items[0].current_stock === 3);
r = await anon("/api/shop/orders/lookup", { method: "POST", body: { order_number: order.order_number, phone: "081200000000" } });
check("lacak dengan HP salah -> 404", r.status === 404);
r = await anon("/api/shop/orders/lookup", { method: "POST", body: { order_number: order.order_number, phone } });
check("lacak dengan HP benar -> 200", r.status === 200 && r.json.data.order_number === order.order_number);
r = await anon("/api/orders");
check("daftar pesanan admin tanpa login -> 401", r.status === 401);
r = await anon("/api/shop/orders", { method: "POST", body: { customer_name: "X", phone: "1", address: "a", city: "b", shipping_method: "XX", items: [] } });
check("pesanan tidak valid -> 400 dengan errors per field", r.status === 400 && r.json.errors?.phone, JSON.stringify(r.json));
r = await staff("/api/orders/" + order.id, { method: "PATCH", body: { action: "confirm_payment" } });
check("staf konfirmasi pembayaran -> 200 DIPROSES", r.status === 200 && r.json.data.status === "DIPROSES", JSON.stringify(r.json));
r = await staff("/api/orders/" + order.id, { method: "PATCH", body: { action: "cancel" } });
check("staf batalkan pesanan -> 403", r.status === 403);
r = await admin("/api/orders/" + order.id, { method: "PATCH", body: { action: "cancel" } });
check("admin batalkan -> DIBATALKAN, stok kembali", r.status === 200 && r.json.data.status === "DIBATALKAN");
r = await admin("/api/products?search=SHP-" + suffix);
check("stok kembali 5", r.json.data.items[0].current_stock === 5);

// --- misc
r = await admin("/api/products?limit=9999");
check("limit > 100 dipotong ke 100", r.status === 200 && r.json.data.limit === 100);
r = await admin("/api/products?sortBy=password;drop");
check("sortBy di luar allow-list tidak error", r.status === 200);
r = await anon("/api/auth/me");
check("me tanpa login -> 401", r.status === 401);

console.log(failed ? "\n" + failed + " pemeriksaan GAGAL" : "\nSemua pemeriksaan lulus");
process.exit(failed ? 1 : 0);
