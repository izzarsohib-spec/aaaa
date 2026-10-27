// Postgres lokal sungguhan (embedded) untuk pengembangan & verifikasi. Bukan untuk produksi.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dir = "./.pgdata";
const port = Number(process.env.LOCAL_PG_PORT ?? 54329);
const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: true });
if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
await pg.start();
for (const name of ["adzkia", "adzkia_test"]) {
  try { await pg.createDatabase(name); } catch { /* sudah ada */ }
}
process.stdout.write(`Postgres lokal siap di port ${port}\n`);
const stop = async () => { await pg.stop(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
setInterval(() => {}, 1 << 30);
