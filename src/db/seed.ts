import "./env";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { closeDb, getDb, schema } from "./index";

/** Seed master: aman dijalankan berulang. Membuat akun ADMIN bila belum ada. */
async function main() {
  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@adzkia.local").toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD ?? "";
  if (password.length < 8) {
    throw new Error("SEED_ADMIN_PASSWORD wajib diisi (minimal 8 karakter)");
  }
  const db = getDb();
  const [existing] = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.email, email));
  if (existing) {
    process.stdout.write("Admin sudah ada, dilewati.\n");
  } else {
    await db.insert(schema.users).values({
      email,
      name: process.env.SEED_ADMIN_NAME ?? "Pemilik Toko",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    });
    process.stdout.write(`Admin dibuat: ${email}\n`);
  }
  await closeDb();
}

main().catch((e) => {
  process.stderr.write(`Seed gagal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
