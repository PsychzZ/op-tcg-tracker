import type { ProviderPrice } from "@/lib/providers/types";

const MIN_SAMPLE = 3;

/**
 * Priority per grade:
 *   PriceCharting (aggregated market price) > eBay-sold (enough samples) > free API > thin eBay-sold > none.
 * PriceCharting only returns the grades it has (raw on Collector; +PSA on Legendary), so for grades it
 * does not cover (PSA on Collector) it is simply absent and eBay-sold takes over.
 */
export function resolvePrice(results: ProviderPrice[], minSample = MIN_SAMPLE): ProviderPrice | null {
  const pc = results.find((r) => r.source === "priceCharting");
  const ebay = results.find((r) => r.source === "ebaySold");
  const free = results.find((r) => r.source === "freeApi");
  if (pc) return pc;
  if (ebay && (ebay.sampleSize ?? 0) >= minSample) return ebay;
  if (free) return free;
  if (ebay) return ebay;
  return null;
}
