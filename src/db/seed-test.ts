import "./env";
import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";

/**
 * Seed uji: memuat baris "Data uji" dari PRD ke database TERPISAH (TEST_DATABASE_URL).
 * Dikosongkan dulu (reset) setiap dijalankan. Menolak jalan bila URL sama dengan DATABASE_URL.
 */
async function main() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL wajib diisi");
  if (url === process.env.DATABASE_URL) throw new Error("TEST_DATABASE_URL tidak boleh sama dengan DATABASE_URL");
  process.env.DATABASE_URL = url;
  const { closeDb, getDb, schema } = await import("./index");
  const db = getDb();
  await migrate(db, { migrationsFolder: "./drizzle" });
  await db.execute(sql.raw("TRUNCATE sale_items, sales, stock_adjustments, products, users RESTART IDENTITY CASCADE"));
  const hash = await bcrypt.hash("password-uji-123", 10);
  await db.insert(schema.users).values([
    { email: "admin@test.local", name: "Admin Uji", role: "ADMIN", passwordHash: hash },
    { email: "kasir@test.local", name: "Kasir Uji", role: "STAFF", passwordHash: hash },
  ]);
  await db.insert(schema.products).values([
    { sku: "SKU-01", name: "Baju Satpam Uji", costPrice: 10000, sellingPrice: 15000, currentStock: 10 },
    { sku: "SKU-02", name: "Topi Satpam Uji", costPrice: 5000, sellingPrice: 8000, currentStock: 3 },
    { sku: "SKU-03", name: "Sepatu Satpam Uji", costPrice: 60000, sellingPrice: 90000, currentStock: 5 },
  ]);
  process.stdout.write("Seed uji selesai (admin@test.local / kasir@test.local, password-uji-123).\n");
  await closeDb();
}

main().catch((e) => {
  process.stderr.write("Seed uji gagal: " + (e instanceof Error ? e.message : String(e)) + "\n");
  process.exit(1);
});
