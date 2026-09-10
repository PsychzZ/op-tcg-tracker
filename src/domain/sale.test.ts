import { describe, it, expect } from "vitest";
import { realizedPnl, realizedTotals } from "./sale";

describe("realizedPnl", () => {
  it("is net proceeds minus the cost basis", () => {
    const pnl = realizedPnl({ quantity: 2, soldPricePerUnit: 300, costBasisPerUnit: 200 });
    expect(pnl).toEqual({ proceeds: 600, fees: 0, net: 600, cost: 400, pnlEur: 200, pnlPct: 50 });
  });

  it("subtracts fees from the proceeds", () => {
    const pnl = realizedPnl({ quantity: 1, soldPricePerUnit: 100, feesEur: 15, costBasisPerUnit: 50 });
    expect(pnl.net).toBe(85);
    expect(pnl.pnlEur).toBe(35);
    expect(pnl.pnlPct).toBe(70);
  });

  it("reports a loss with a negative percentage", () => {
    const pnl = realizedPnl({ quantity: 1, soldPricePerUnit: 50, costBasisPerUnit: 100 });
    expect(pnl.pnlEur).toBe(-50);
    expect(pnl.pnlPct).toBe(-50);
  });

  it("stays unknown without a purchase price", () => {
    const pnl = realizedPnl({ quantity: 3, soldPricePerUnit: 100 });
    expect(pnl.proceeds).toBe(300);
    expect(pnl.net).toBe(300);
    expect(pnl.cost).toBeNull();
    expect(pnl.pnlEur).toBeNull();
    expect(pnl.pnlPct).toBeNull();
  });

  it("ignores negative fees and rounds to cents", () => {
    expect(realizedPnl({ quantity: 1, soldPricePerUnit: 10, feesEur: -5, costBasisPerUnit: 0 }).fees).toBe(0);
    expect(realizedPnl({ quantity: 3, soldPricePerUnit: 33.333, costBasisPerUnit: 10 }).proceeds).toBe(100);
  });
});

describe("realizedTotals", () => {
  it("sums the sales that have a cost basis", () => {
    const totals = realizedTotals([
      { quantity: 1, soldPricePerUnit: 200, costBasisPerUnit: 100 },
      { quantity: 2, soldPricePerUnit: 100, feesEur: 10, costBasisPerUnit: 50 },
    ]);
    expect(totals.count).toBe(2);
    expect(totals.units).toBe(3);
    expect(totals.proceeds).toBe(400);
    expect(totals.fees).toBe(10);
    expect(totals.cost).toBe(200);
    expect(totals.pnlEur).toBe(190);
    expect(totals.pnlPct).toBe(95);
    expect(totals.unknownCostCount).toBe(0);
  });

  it("excludes sales without a cost basis from the profit but counts them", () => {
    const totals = realizedTotals([
      { quantity: 1, soldPricePerUnit: 200, costBasisPerUnit: 100 },
      { quantity: 1, soldPricePerUnit: 500 },
    ]);
    expect(totals.proceeds).toBe(700);
    expect(totals.pnlEur).toBe(100);
    expect(totals.pnlPct).toBe(100);
    expect(totals.unknownCostCount).toBe(1);
  });

  it("is empty-safe", () => {
    const totals = realizedTotals([]);
    expect(totals).toEqual({
      count: 0,
      units: 0,
      proceeds: 0,
      fees: 0,
      cost: 0,
      pnlEur: 0,
      pnlPct: null,
      unknownCostCount: 0,
    });
  });
});
