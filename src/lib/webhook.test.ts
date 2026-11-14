import { describe, expect, it } from "vitest";
import { MAX_SKEW_SECONDS, signPayload, verifyPayload } from "./webhook";

const SECRET = "rahasia-uji-minimal-32-karakter-xxxx";
const NOW = 1_800_000_000_000;
const ts = String(NOW / 1000);
const body = JSON.stringify({ type: "goods_received", receipt_no: "BD-1" });

describe("verifikasi tanda tangan webhook", () => {
  it("menerima tanda tangan yang benar", () => {
    expect(verifyPayload(SECRET, ts, signPayload(SECRET, ts, body), body, NOW)).toBe(true);
  });
  it("menolak body yang diubah", () => {
    const sig = signPayload(SECRET, ts, body);
    expect(verifyPayload(SECRET, ts, sig, body + " ", NOW)).toBe(false);
  });
  it("menolak rahasia yang salah", () => {
    expect(verifyPayload(SECRET, ts, signPayload("rahasia-lain", ts, body), body, NOW)).toBe(false);
  });
  it("menolak kiriman kedaluwarsa dan yang dari masa depan", () => {
    const old = String(NOW / 1000 - MAX_SKEW_SECONDS - 1);
    expect(verifyPayload(SECRET, old, signPayload(SECRET, old, body), body, NOW)).toBe(false);
    const future = String(NOW / 1000 + MAX_SKEW_SECONDS + 1);
    expect(verifyPayload(SECRET, future, signPayload(SECRET, future, body), body, NOW)).toBe(false);
  });
  it("menolak header kosong, bukan hex, atau panjang salah", () => {
    expect(verifyPayload(SECRET, null, "abcd", body, NOW)).toBe(false);
    expect(verifyPayload(SECRET, ts, null, body, NOW)).toBe(false);
    expect(verifyPayload(SECRET, ts, "zzzz", body, NOW)).toBe(false);
    expect(verifyPayload(SECRET, ts, "abcd", body, NOW)).toBe(false);
  });
});
