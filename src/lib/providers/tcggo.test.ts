import { describe, it, expect } from "vitest";
import { mapTcgGoResponse } from "./tcggo";

const fixture = {
  prices: {
    tcg_player: { currency: "USD", market_price: 210 },
    ebay: {
      currency: "USD",
      graded: {
        psa: {
          "10": { median_price: 980, sample_size: 7 },
          "9": { median_price: 430, sample_size: 4 },
        },
      },
    },
  },
};

describe("mapTcgGoResponse", () => {
  it("maps market price to raw and eBay PSA medians to psa9/psa10", () => {
    const prices = mapTcgGoResponse(fixture);
    expect(prices.find((p) => p.grade === "raw")?.priceNative).toBe(210);
    const psa10 = prices.find((p) => p.grade === "psa10")!;
    expect(psa10.priceNative).toBe(980);
    expect(psa10.sampleSize).toBe(7);
    expect(psa10.source).toBe("ebaySold");
    expect(prices.find((p) => p.grade === "psa9")?.source).toBe("ebaySold");
  });
  it("returns empty when prices are missing", () => {
    expect(mapTcgGoResponse({})).toEqual([]);
  });
});
