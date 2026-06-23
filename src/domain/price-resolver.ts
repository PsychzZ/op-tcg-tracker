import type { ProviderPrice } from "@/lib/providers/types";

const MIN_SAMPLE = 3;

/** Priority: eBay-sold (enough samples) > free API > thin eBay-sold > none. */
export function resolvePrice(results: ProviderPrice[], minSample = MIN_SAMPLE): ProviderPrice | null {
  const ebay = results.find((r) => r.source === "ebaySold");
  const free = results.find((r) => r.source === "freeApi");
  if (ebay && (ebay.sampleSize ?? 0) >= minSample) return ebay;
  if (free) return free;
  if (ebay) return ebay;
  return null;
}
