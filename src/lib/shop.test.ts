import { describe, expect, it } from "vitest";
import { SHIPPING, normalizePhone } from "./shop";

describe("normalizePhone", () => {
  it("menyeragamkan 08xx, 628xx, dan +62 8xx ke +62", () => {
    expect(normalizePhone("0812 3456 7890")).toBe("+6281234567890");
    expect(normalizePhone("6281234567890")).toBe("+6281234567890");
    expect(normalizePhone("+62 812-3456-7890")).toBe("+6281234567890");
    expect(normalizePhone("81234567890")).toBe("+6281234567890");
  });
  it("menolak nomor yang tidak wajar", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
    expect(normalizePhone("021123456")).toBeNull();
  });
});

describe("SHIPPING", () => {
  it("id unik dan ongkir non-negatif", () => {
    expect(new Set(SHIPPING.map((s) => s.id)).size).toBe(SHIPPING.length);
    expect(SHIPPING.every((s) => s.cost >= 0)).toBe(true);
  });
});
