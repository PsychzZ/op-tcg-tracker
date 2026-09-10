import type { Variant } from "./card";
import { officialCardImageUrl } from "./card-image";

/**
 * Whether a card needs a **provider image** stored in `card.imageUrl`.
 *
 * The app can serve the official Japanese art for a standard set number, but that art always shows
 * the *base* card. For alt-art / manga / parallel / serial variants it would therefore be the wrong
 * picture, and for promos ("P-063", "P-BVB-001") the official URL cannot be built at all. Those
 * rows get the per-variant PriceCharting image stored instead.
 */
export function needsProviderImage(number: string | null | undefined, variant: Variant): boolean {
  if (variant !== "normal") return true;
  return officialCardImageUrl(number) === null;
}
