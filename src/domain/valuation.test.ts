import { describe, it, expect } from "vitest";
import { holdingPnl, portfolioTotals, type OwnedItem } from "./valuation";

describe("holdingPnl", () => {
  it("computes value, cost, and profit", () => {
    const r = holdingPnl({ grade: "psa10", quantity: 2, purchasePricePerUnit: 100 }, 150);
    expect(r.value).toBe(300);
    expect(r.cost).toBe(200);
    expect(r.pnlEur).toBe(100);
    expect(r.pnlPct).toBe(50);
  });
  it("handles missing purchase price", () => {
    const r = holdingPnl({ grade: "raw", quantity: 1, purchasePricePerUnit: null }, 50);
    expect(r.value).toBe(50);
    expect(r.cost).toBeNull();
    expect(r.pnlEur).toBeNull();
  });
});

describe("portfolioTotals", () => {
  it("sums value per grade", () => {
    const items: OwnedItem[] = [
      { grade: "psa10", quantity: 1, purchasePricePerUnit: null },
      { grade: "psa10", quantity: 2, purchasePricePerUnit: null },
      { grade: "raw", quantity: 1, purchasePricePerUnit: null },
    ];
    const prices = { psa10: 100, raw: 10, psa9: 0 };
    const totals = portfolioTotals(items, prices);
    expect(totals.psa10).toBe(300);
    expect(totals.raw).toBe(10);
  });
});
