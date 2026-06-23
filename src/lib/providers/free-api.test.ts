import { describe, it, expect } from "vitest";
import { mapFreeApiResponse } from "./free-api";

// Representative shape — VERIFY against the real API and adjust if different.
const fixture = {
  data: [
    { grade: "raw", price: 210, currency: "USD" },
    { grade: "PSA 9", price: 430, currency: "USD" },
    { grade: "PSA 10", price: 980, currency: "USD" },
    { grade: "BGS 9.5", price: 700, currency: "USD" },
  ],
};

describe("mapFreeApiResponse", () => {
  it("maps known grades and ignores unsupported ones", () => {
    const prices = mapFreeApiResponse(fixture);
    expect(prices).toHaveLength(3);
    expect(prices.find((p) => p.grade === "psa10")?.priceNative).toBe(980);
    expect(prices.every((p) => p.source === "freeApi")).toBe(true);
  });
});
