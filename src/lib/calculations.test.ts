import { describe, expect, it } from "vitest";
import {
  PRICE_BELOW_COST_MESSAGE,
  calculateProfit,
  calculateSubtotal,
  jakartaDayRange,
  roundRupiah,
  summarizeSales,
  toJakartaDate,
  validateProductPrice,
} from "./calculations";

describe("validateProductPrice", () => {
  it("melempar error jika harga_jual < modal", () => {
    expect(() => validateProductPrice(50000, 45000)).toThrow(PRICE_BELOW_COST_MESSAGE);
  });
  it("mengizinkan harga jual sama dengan atau di atas modal", () => {
    expect(() => validateProductPrice(10000, 10000)).not.toThrow();
    expect(() => validateProductPrice(10000, 15000)).not.toThrow();
  });
  it("menolak modal negatif", () => {
    expect(() => validateProductPrice(-1, 10)).toThrow(RangeError);
  });
  it("membandingkan setelah pembulatan Rupiah", () => {
    expect(() => validateProductPrice(10000.4, 10000.2)).not.toThrow();
    expect(() => validateProductPrice(10000.6, 10000.4)).toThrow(PRICE_BELOW_COST_MESSAGE);
  });
});

describe("calculateProfit", () => {
  it("= (hargaJual - modal) * qty (data uji PRD)", () => {
    expect(calculateProfit(10000, 15000, 2)).toBe(10000);
  });
  it("margin nol menghasilkan 0 (bukan -0)", () => {
    expect(Object.is(calculateProfit(5000, 5000, 3), 0)).toBe(true);
  });
  it("menolak qty 0, negatif, atau pecahan", () => {
    expect(() => calculateProfit(1, 2, 0)).toThrow(RangeError);
    expect(() => calculateProfit(1, 2, -1)).toThrow(RangeError);
    expect(() => calculateProfit(1, 2, 1.5)).toThrow(RangeError);
  });
  it("membulatkan harga desimal ke Rupiah sebelum dikalikan", () => {
    expect(calculateProfit(1000.4, 1500.5, 3)).toBe((1501 - 1000) * 3);
  });
  it("tidak menyisakan error float", () => {
    expect(roundRupiah(0.1 + 0.2)).toBe(0);
    expect(roundRupiah(1.005 * 1000)).toBe(1005);
    expect(roundRupiah(2.5)).toBe(3);
    expect(roundRupiah(-2.5)).toBe(-3);
  });
  it("menolak nilai tak terhingga", () => {
    expect(() => roundRupiah(Infinity)).toThrow(RangeError);
  });
});

describe("calculateSubtotal", () => {
  it("= selling_price_at_sale * quantity", () => {
    expect(calculateSubtotal(15000, 2)).toBe(30000);
  });
});

describe("zona waktu WIB", () => {
  it("23:30 UTC sudah hari berikutnya di WIB", () => {
    expect(toJakartaDate(new Date("2026-03-09T23:30:00Z"))).toBe("2026-03-10");
    expect(toJakartaDate(new Date("2026-03-10T16:59:59Z"))).toBe("2026-03-10");
    expect(toJakartaDate(new Date("2026-03-10T17:00:00Z"))).toBe("2026-03-11");
  });
  it("rentang hari = 00:00 s.d. 23:59 WIB", () => {
    const { start, end } = jakartaDayRange("2026-03-10");
    expect(start.toISOString()).toBe("2026-03-09T17:00:00.000Z");
    expect(end.toISOString()).toBe("2026-03-10T17:00:00.000Z");
  });
  it("menolak format tanggal salah", () => {
    expect(() => jakartaDayRange("10-03-2026")).toThrow(RangeError);
  });
});

describe("summarizeSales (ringkasan harian)", () => {
  const item = { quantity: 2, costPriceAtSale: 10000, sellingPriceAtSale: 15000 };
  const day = "2026-03-10";

  it("hanya menghitung COMPLETED", () => {
    const r = summarizeSales(
      [
        { status: "COMPLETED", createdAt: new Date("2026-03-10T03:00:00Z"), items: [item] },
        { status: "CANCELLED", createdAt: new Date("2026-03-10T04:00:00Z"), items: [item] },
      ],
      day,
    );
    expect(r).toEqual({ total_sales_count: 1, total_revenue: 30000, total_profit: 10000 });
  });
  it("laba = SUM((jual - modal) * qty) memakai snapshot", () => {
    const r = summarizeSales(
      [
        {
          status: "COMPLETED",
          createdAt: new Date("2026-03-10T03:00:00Z"),
          items: [item, { quantity: 1, costPriceAtSale: 2000, sellingPriceAtSale: 3500 }],
        },
      ],
      day,
    );
    expect(r.total_profit).toBe(10000 + 1500);
    expect(r.total_revenue).toBe(30000 + 3500);
  });
  it("batas hari memakai WIB, bukan UTC", () => {
    const r = summarizeSales(
      [
        { status: "COMPLETED", createdAt: new Date("2026-03-09T16:59:59Z"), items: [item] },
        { status: "COMPLETED", createdAt: new Date("2026-03-09T17:00:00Z"), items: [item] },
        { status: "COMPLETED", createdAt: new Date("2026-03-10T16:59:59Z"), items: [item] },
        { status: "COMPLETED", createdAt: new Date("2026-03-10T17:00:00Z"), items: [item] },
      ],
      day,
    );
    expect(r.total_sales_count).toBe(2);
  });
  it("hari tanpa transaksi menghasilkan 0", () => {
    expect(summarizeSales([], day)).toEqual({
      total_sales_count: 0,
      total_revenue: 0,
      total_profit: 0,
    });
  });
});
