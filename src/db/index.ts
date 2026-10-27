import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** Db atau transaksi: repository menerima keduanya. */
export type Executor = Db | Tx;

const globalForDb = globalThis as unknown as { __db?: Db; __sql?: postgres.Sql };

export function getDb(): Db {
  if (globalForDb.__db) return globalForDb.__db;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL belum diisi");
  const viaPooler = /pooler\.supabase\.com|:6543\//.test(url);
  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    // Supabase pooler (mode transaction) tidak mendukung prepared statement
    prepare: !viaPooler,
    onnotice: () => {},
  });
  globalForDb.__sql = client;
  globalForDb.__db = drizzle(client, { schema });
  return globalForDb.__db;
}

export async function closeDb(): Promise<void> {
  await globalForDb.__sql?.end({ timeout: 5 });
  globalForDb.__sql = undefined;
  globalForDb.__db = undefined;
}

export { schema };
