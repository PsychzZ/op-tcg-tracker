import { extractPcImageUrl } from "@/domain/pricecharting-image";
import { fetchText, sleep } from "./http";

/**
 * Shared scraping helpers for PriceCharting's public pages, used by the price sync and the catalog
 * refresh. The generic request helpers live in ./http (the Japanese-name filler needs the same ones);
 * they are re-exported here so callers keep importing everything PriceCharting-related from one place.
 */
export { fetchText, sleep };

export const PC_CATEGORY_URL = "https://www.pricecharting.com/category/one-piece-cards";
export const PC_CONSOLE_URL = (slug: string) => `https://www.pricecharting.com/console/${slug}`;

/**
 * The per-variant product image for a PriceCharting product id. Each variant is its own product, so
 * this is the art that actually belongs to the row (unlike the number-based official art).
 */
export async function fetchProductImageUrl(pcProductId: string, size = 1600): Promise<string | null> {
  const html = await fetchText(`https://www.pricecharting.com/offers?product=${encodeURIComponent(pcProductId)}`);
  return html ? extractPcImageUrl(html, size) : null;
}
