import { describe, it, expect } from "vitest";
import { mapEbaySoldResponse } from "./ebay-sold";

// Representative shape — VERIFY against the real source and adjust if different.
const fixture = {
  results: [
    {
      grade: "PSA 10",
      median: 980,
      currency: "USD",
      sampleSize: 7,
      sales: [{ date: "2026-06-18", price: 990, currency: "USD", url: "https://ebay.com/itm/1" }],
    },
    { grade: "raw", median: 210, currency: "USD", sampleSize: 12, sales: [] },
  ],
};

describe("mapEbaySoldResponse", () => {
  it("maps medians, sample sizes, and observations", () => {
    const prices = mapEbaySoldResponse(fixture);
    const psa10 = prices.find((p) => p.grade === "psa10")!;
    expect(psa10.priceNative).toBe(980);
    expect(psa10.sampleSize).toBe(7);
    expect(psa10.source).toBe("ebaySold");
    expect(psa10.observations?.[0]?.priceNative).toBe(990);
  });
});
