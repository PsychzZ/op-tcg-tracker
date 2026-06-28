import { describe, it, expect } from "vitest";
import { mapPriceChartingResponse } from "./pricecharting";

describe("mapPriceChartingResponse", () => {
  it("maps loose-price (cents) to raw in USD units", () => {
    const prices = mapPriceChartingResponse({ "loose-price": 16844, status: "success" });
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({
      grade: "raw",
      priceNative: 168.44,
      currency: "USD",
      source: "priceCharting",
    });
  });

  it("maps graded fields to PSA 9 / PSA 10 when present (Legendary tier)", () => {
    const prices = mapPriceChartingResponse({
      "loose-price": 1000,
      "graded-price": 5000,
      "manual-only-price": 12000,
    });
    expect(prices.find((p) => p.grade === "raw")?.priceNative).toBe(10);
    expect(prices.find((p) => p.grade === "psa9")?.priceNative).toBe(50);
    expect(prices.find((p) => p.grade === "psa10")?.priceNative).toBe(120);
  });

  it("ignores missing or zero prices", () => {
    expect(mapPriceChartingResponse({ status: "success" })).toEqual([]);
    expect(mapPriceChartingResponse({ "loose-price": 0 })).toEqual([]);
  });
});
