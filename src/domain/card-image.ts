const OFFICIAL = "https://www.onepiece-cardgame.com/images/cardlist/card";

// Standard set-card numbers like OP09-004, ST18-005, EB01-006, PRB01-001.
const NUMBER_RE = /^[A-Z]{1,4}\d{1,2}-\d{2,3}$/;

function normalize(number: string | null | undefined): string | null {
  if (!number) return null;
  const n = number.trim().toUpperCase();
  return NUMBER_RE.test(n) ? n : null;
}

/**
 * Upstream official Japanese card image — SERVER-SIDE ONLY. The official host serves these fine to
 * our server but some cross-site browser requests fail, so the browser must go through the proxy below.
 */
export function officialCardImageUrl(number: string | null | undefined): string | null {
  const n = normalize(number);
  return n ? `${OFFICIAL}/${n}.png` : null;
}

/**
 * Same-origin proxied image URL for the browser (`/api/card-image/<number>`).
 * Returns null for non-standard numbers (e.g. P-xxx promos) → caller shows a fallback.
 */
export function cardImageUrl(number: string | null | undefined): string | null {
  const n = normalize(number);
  return n ? `/api/card-image/${n}` : null;
}
