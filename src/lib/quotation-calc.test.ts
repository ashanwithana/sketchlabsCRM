import { describe, expect, it } from "vitest";
import { calcLine, calcTotals } from "./quotation-calc";
import { parseMoney, parsePercentToBp, toDecimalString, formatMoney } from "./money";
import { effectiveQuotationStatus } from "./quotation-status";

describe("line calculation", () => {
  it("applies discount before tax", () => {
    // 3 x 1000.00 = 3000.00, less 300.00 discount = 2700.00, plus 15% = 405.00
    const r = calcLine({ quantity: 3, unitPrice: 100000, discount: 30000, taxRateBp: 1500 });
    expect(r).toEqual({ gross: 300000, discount: 30000, taxable: 270000, tax: 40500, total: 310500 });
  });

  it("caps discount at the gross amount and never goes negative", () => {
    const over = calcLine({ quantity: 1, unitPrice: 5000, discount: 99999, taxRateBp: 1000 });
    expect(over.discount).toBe(5000);
    expect(over.taxable).toBe(0);
    expect(over.total).toBe(0);
    const negative = calcLine({ quantity: 1, unitPrice: 5000, discount: -500, taxRateBp: 0 });
    expect(negative.discount).toBe(0);
  });

  it("rounds tax half up to the nearest minor unit", () => {
    // 5 cents at 7.5% = 0.375 cents, which rounds down to 0.
    expect(calcLine({ quantity: 1, unitPrice: 5, discount: 0, taxRateBp: 750 }).tax).toBe(0);
    // 10 cents at 5% = 0.5 cents, which rounds half up to 1.
    expect(calcLine({ quantity: 1, unitPrice: 10, discount: 0, taxRateBp: 500 }).tax).toBe(1);
  });

  it("handles zero tax and zero price", () => {
    expect(calcLine({ quantity: 5, unitPrice: 0, discount: 0, taxRateBp: 1500 }).total).toBe(0);
    expect(calcLine({ quantity: 2, unitPrice: 1000, discount: 0, taxRateBp: 0 }).total).toBe(2000);
  });
});

describe("document totals", () => {
  it("sums lines and keeps subtotal - discount + tax = grand total", () => {
    const t = calcTotals([
      { quantity: 3, unitPrice: 100000, discount: 30000, taxRateBp: 1500 },
      { quantity: 1, unitPrice: 250050, discount: 0, taxRateBp: 0 },
      { quantity: 2, unitPrice: 33333, discount: 1111, taxRateBp: 1000 },
    ]);
    expect(t.subtotal).toBe(300000 + 250050 + 66666);
    expect(t.discountTotal).toBe(30000 + 0 + 1111);
    expect(t.subtotal - t.discountTotal + t.taxTotal).toBe(t.grandTotal);
    expect(t.lines).toHaveLength(3);
  });

  it("returns zeros for an empty quote", () => {
    expect(calcTotals([])).toEqual({ lines: [], subtotal: 0, discountTotal: 0, taxTotal: 0, grandTotal: 0 });
  });
});

describe("money parsing", () => {
  it("parses plain and thousands-separated amounts", () => {
    expect(parseMoney("1250")).toBe(125000);
    expect(parseMoney("1,250.5")).toBe(125050);
    expect(parseMoney("0.07")).toBe(7);
  });

  it("rejects negatives, letters, and more than two decimals", () => {
    expect(parseMoney("-5")).toBeNull();
    expect(parseMoney("12abc")).toBeNull();
    expect(parseMoney("1.001")).toBeNull();
    expect(parseMoney("")).toBeNull();
  });

  it("parses percentages to basis points within 0-100", () => {
    expect(parsePercentToBp("15")).toBe(1500);
    expect(parsePercentToBp("7.5")).toBe(750);
    expect(parsePercentToBp("100")).toBe(10000);
    expect(parsePercentToBp("100.5")).toBeNull();
    expect(parsePercentToBp("-1")).toBeNull();
  });

  it("formats for display and form fields", () => {
    expect(toDecimalString(125050)).toBe("1250.50");
    expect(formatMoney(125050, "USD")).toBe("$1,250.50");
    expect(formatMoney(125050, "XX")).toContain("1250.50");
  });
});

describe("expiry-aware status", () => {
  it("is consistent with the calculation date boundary", () => {
    const expiry = new Date("2026-06-30T23:59:59.999Z");
    expect(effectiveQuotationStatus("SENT", expiry, new Date("2026-06-30T23:00:00Z"))).toBe("SENT");
    expect(effectiveQuotationStatus("SENT", expiry, new Date("2026-07-01T00:00:00Z"))).toBe("EXPIRED");
  });
});
