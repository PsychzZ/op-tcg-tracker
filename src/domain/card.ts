export type Rarity = "C" | "UC" | "R" | "SR" | "SEC" | "SP" | "L";
export type Variant = "normal" | "altArt" | "mangaArt" | "parallel" | "serial";
export type Category = "booster" | "starter" | "promo" | "specialCollab";
export type Grade = "raw" | "psa9" | "psa10";

export interface TrackableCard {
  language: string;
  rarity: Rarity;
  variant: Variant;
  category: Category;
  trackOverride?: boolean | null;
}

const TRACKED_RARITIES: Rarity[] = ["SR", "SEC", "SP", "L"];
const TRACKED_VARIANTS: Variant[] = ["altArt", "mangaArt", "parallel", "serial"];
const TRACKED_CATEGORIES: Category[] = ["promo", "specialCollab"];

/**
 * Decides whether a card is tracked.
 * Rule #1 (inviolable): only Japanese cards. Non-JP is never tracked, even with an override.
 * Otherwise: a manual override wins; else track SR/SEC/SP/L, any special variant,
 * or promo/special-collab cards. Plain C/UC/R are excluded.
 */
export function isTrackable(card: TrackableCard): boolean {
  if (card.language !== "ja") return false;
  if (card.trackOverride === true) return true;
  if (card.trackOverride === false) return false;
  return (
    TRACKED_RARITIES.includes(card.rarity) ||
    TRACKED_VARIANTS.includes(card.variant) ||
    TRACKED_CATEGORIES.includes(card.category)
  );
}
