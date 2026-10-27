import { tooMany } from "./errors";

/** Rate limit in-memory (per instance). Cukup untuk satu toko; ganti store bila multi-instance. */
const buckets = new Map<string, number[]>();

export function limit(key: string, max: number, windowMs: number, message = "Terlalu banyak permintaan"): void {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    buckets.set(key, hits);
    throw tooMany(message, (hits[0] + windowMs - now) / 1000);
  }
  hits.push(now);
  buckets.set(key, hits);
}

export const RATE = {
  read: { max: 120, windowMs: 60_000 },
  write: { max: 20, windowMs: 60_000 },
} as const;

/* Login: 5 GAGAL / 15 menit per akun dan per IP, jeda membesar, tanpa kunci permanen. */
const LOGIN_WINDOW = 15 * 60_000;
const LOGIN_MAX = 5;
const failures = new Map<string, number[]>();

function failuresOf(key: string, now: number) {
  const f = (failures.get(key) ?? []).filter((t) => now - t < LOGIN_WINDOW);
  if (f.length) failures.set(key, f);
  else failures.delete(key);
  return f;
}

/** Lempar 429 bila akun atau IP melewati batas; jeda = 30 detik * 2^(kelebihan), maks 15 menit. */
export function assertLoginAllowed(ip: string, account: string): void {
  const now = Date.now();
  for (const key of ["ip:" + ip, "acct:" + account]) {
    const f = failuresOf(key, now);
    if (f.length >= LOGIN_MAX) {
      const over = f.length - LOGIN_MAX;
      const delayMs = Math.min(2 ** over * 30_000, LOGIN_WINDOW);
      const wait = f[f.length - 1] + delayMs - now;
      if (wait > 0) throw tooMany("Terlalu banyak percobaan login. Coba lagi nanti.", wait / 1000);
    }
  }
}

export function recordLoginFailure(ip: string, account: string): void {
  const now = Date.now();
  for (const key of ["ip:" + ip, "acct:" + account]) {
    const f = failuresOf(key, now);
    f.push(now);
    failures.set(key, f);
  }
}

export function clearLoginFailures(account: string): void {
  failures.delete("acct:" + account);
}

/** Endpoint mahal: satu permintaan bersamaan per pengguna. */
const inflight = new Set<string>();
export async function exclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
  if (inflight.has(key)) throw tooMany("Proses sebelumnya masih berjalan", 2);
  inflight.add(key);
  try {
    return await fn();
  } finally {
    inflight.delete(key);
  }
}
