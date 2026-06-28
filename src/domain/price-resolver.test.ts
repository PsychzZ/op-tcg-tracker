import { describe, it, expect } from "vitest";
import { resolvePrice } from "./price-resolver";
import type { ProviderPrice } from "@/lib/providers/types";

const ebay = (sampleSize: number): ProviderPrice => ({ grade: "psa10", priceNative: 100, currency: "USD", source: "ebaySold", sampleSize });
const free = (): ProviderPrice => ({ grade: "psa10", priceNative: 90, currency: "USD", source: "freeApi" });
const pc = (): ProviderPrice => ({ grade: "raw", priceNative: 150, currency: "USD", source: "priceCharting" });

describe("resolvePrice", () => {
  it("prefers PriceCharting (aggregated market price) above all others", () => {
    expect(resolvePrice([free(), ebay(5), pc()])?.source).toBe("priceCharting");
  });
  it("prefers eBay-sold with enough samples", () => {
    expect(resolvePrice([free(), ebay(5)])?.source).toBe("ebaySold");
  });
  it("falls back to free API when eBay samples are too thin", () => {
    expect(resolvePrice([free(), ebay(1)])?.source).toBe("freeApi");
  });
  it("uses thin eBay data when nothing else exists", () => {
    expect(resolvePrice([ebay(1)])?.source).toBe("ebaySold");
  });
  it("returns null when there is no data", () => {
    expect(resolvePrice([])).toBeNull();
  });
});
