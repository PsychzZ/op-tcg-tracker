import { extractPcImageUrl } from "@/domain/pricecharting-image";

/**
 * Shared scraping helpers for PriceCharting's public pages, used by the price sync and the catalog
 * refresh. Deliberately tiny and dependency-free: the pages are plain HTML and the callers decide
 * what to do when one comes back empty.
 */
export const PC_CATEGORY_URL = "https://www.pricecharting.com/category/one-piece-cards";
export const PC_CONSOLE_URL = (slug: string) => `https://www.pricecharting.com/console/${slug}`;

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** GET a page with a few retries; returns "" when it stays unavailable (caller treats that as "no data"). */
export async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) return await res.text();
      if (res.status === 429) await sleep(3000);
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return "";
}

/**
 * The per-variant product image for a PriceCharting product id. Each variant is its own product, so
 * this is the art that actually belongs to the row (unlike the number-based official art).
 */
export async function fetchProductImageUrl(pcProductId: string, size = 1600): Promise<string | null> {
  const html = await fetchText(`https://www.pricecharting.com/offers?product=${encodeURIComponent(pcProductId)}`);
  return html ? extractPcImageUrl(html, size) : null;
}
