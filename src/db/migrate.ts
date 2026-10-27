import "./env";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "./index";

async function main() {
  await migrate(getDb(), { migrationsFolder: "./drizzle" });
  process.stdout.write("Migrasi selesai.\n");
  await closeDb();
}

main().catch((e) => {
  process.stderr.write(`Migrasi gagal: ${e instanceof Error ? e.message : String(e)}\n`);
  process.exit(1);
});
