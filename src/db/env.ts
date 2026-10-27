import { existsSync } from "node:fs";

/** Muat .env.local / .env untuk skrip CLI (Next.js memuatnya sendiri). */
for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) process.loadEnvFile(f);
}
