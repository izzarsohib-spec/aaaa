import { createHmac, timingSafeEqual } from "node:crypto";

export const SIGNATURE_HEADER = "x-pengadaan-signature";
export const TIMESTAMP_HEADER = "x-pengadaan-timestamp";
/** Selisih waktu maksimal pengirim-penerima (detik); menolak kiriman lama yang diputar ulang. */
export const MAX_SKEW_SECONDS = 300;

/** Tanda tangan = hex HMAC-SHA256 dari "<timestamp>.<body mentah>". */
export function signPayload(secret: string, timestamp: string, rawBody: string): string {
  return createHmac("sha256", secret).update(timestamp + "." + rawBody).digest("hex");
}

export function verifyPayload(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  rawBody: string,
  nowMs = Date.now(),
): boolean {
  if (!timestamp || !signature || !/^\d{9,12}$/.test(timestamp)) return false;
  if (Math.abs(nowMs / 1000 - Number(timestamp)) > MAX_SKEW_SECONDS) return false;
  const expected = Buffer.from(signPayload(secret, timestamp, rawBody), "hex");
  const given = Buffer.from(signature.trim().toLowerCase(), "hex");
  return given.length === expected.length && timingSafeEqual(given, expected);
}
