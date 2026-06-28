const GCS = "https://commondatastorage.googleapis.com/images.pricecharting.com";
const HASH_RE = /images\.pricecharting\.com\/([a-z0-9]+)\/\d+\.(?:jpg|png)/i;

/**
 * Extract a PriceCharting product image (full Google Cloud Storage URL at the given size) from an
 * /offers?product=<id> page. Each variant is its own product, so this is the correct per-variant art.
 */
export function extractPcImageUrl(html: string, size = 1600): string | null {
  const m = html.match(HASH_RE);
  return m ? `${GCS}/${m[1]}/${size}.jpg` : null;
}

/** Swap the size segment of a PriceCharting GCS image URL. No-op for other URLs (e.g. the proxy). */
export function resizePcImage(url: string | null | undefined, size: number): string | null {
  if (!url) return null;
  return url.replace(/(\/images\.pricecharting\.com\/[a-z0-9]+)\/\d+\.jpg$/i, `$1/${size}.jpg`);
}
