import type { Rarity, Variant, Category } from "./card";
import { deriveCard } from "./card-set";

/** A product row from PriceCharting's search endpoint (/api/products). */
export interface PcSearchProduct {
  id: string | number;
  "console-name": string;
  "product-name": string;
}

/** Card classified from a PriceCharting product, ready to upsert. */
export interface PcCatalogCard {
  externalId: string;
  name: string;
  number: string | null;
  setCode: string | null;
  rarity: Rarity;
  variant: Variant;
  category: Category;
  language: "ja";
  providerIds: { priceCharting: string };
}

// e.g. OP13-007, ST18-005, EB01-006
const NUMBER_RE = /\b([A-Z]{1,4}\d{1,2}-\d{2,3})\b/i;

/** Rule #1 (inviolable): only Japanese One Piece sets. PriceCharting labels them "... Japanese ...". */
export function isJapaneseOnePiece(consoleName: string): boolean {
  return /one piece/i.test(consoleName) && /japanese/i.test(consoleName);
}

export function parseProductName(productName: string): {
  baseName: string;
  number: string | null;
  tags: string[];
} {
  const tags = [...productName.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1].trim());
  const numMatch = productName.match(NUMBER_RE);
  const number = numMatch ? numMatch[1].toUpperCase() : null;
  let baseName = productName.replace(/\[[^\]]*\]/g, " ");
  if (numMatch) baseName = baseName.replace(numMatch[0], " ");
  baseName = baseName.replace(/\s+/g, " ").trim();
  return { baseName, number, tags };
}

function tagRarity(tags: string[]): Rarity | null {
  for (const t of tags) {
    const s = t.toUpperCase();
    if (s === "SEC") return "SEC";
    if (s === "SP" || s === "SP CARD" || s === "SPECIAL") return "SP";
    if (s === "SR") return "SR";
    if (s === "L" || s === "LEADER") return "L";
  }
  return null;
}

function tagVariant(tags: string[]): Variant {
  const joined = tags.join(" ").toLowerCase();
  if (/serial|numbered/.test(joined)) return "serial";
  if (/manga|comic/.test(joined)) return "mangaArt";
  if (/parallel/.test(joined)) return "parallel";
  if (/alt(ernate)? art/.test(joined)) return "altArt";
  return "normal";
}

/**
 * Classify a PriceCharting product into a trackable special card, or return null to skip.
 * Skips: non-Japanese sets, DON!! cards, and plain base cards (no special rarity/variant/promo).
 * Display rarity is best-effort: an explicit tag wins; otherwise inferred from context.
 */
/**
 * Classify any Japanese One Piece product into a catalog card (no special-card gate).
 * Returns null only for non-Japanese sets and DON!! cards. Display rarity is best-effort.
 */
export function classifyPcCard(p: PcSearchProduct): PcCatalogCard | null {
  if (!isJapaneseOnePiece(p["console-name"])) return null;
  const productName = p["product-name"] ?? "";
  if (/^don!*\s*card/i.test(productName)) return null;

  const { baseName, number, tags } = parseProductName(productName);
  // Number is the source of truth for set/category — keeps OPxx promo variants inside set OPxx and
  // drops sealed products (Booster Box, Sealed Deck, …) that have no card number. See card-set.ts.
  const derived = deriveCard(`${baseName} ${number ?? ""}`, number, "booster");
  if (!derived) return null;

  const name = baseName.replace(derived.number, "").replace(/\s+/g, " ").trim() || baseName || productName;
  const variant = tagVariant(tags);
  const displayRarity: Rarity = tagRarity(tags) ?? (derived.category === "promo" ? "SP" : "SR");
  const id = String(p.id);

  return {
    externalId: `pc-${id}`,
    name,
    number: derived.number,
    setCode: derived.setCode,
    rarity: displayRarity,
    variant,
    category: derived.category,
    language: "ja",
    providerIds: { priceCharting: id },
  };
}

/**
 * Classify a product AND apply the special-card gate (explicit high rarity, special variant, or
 * promo). Used by the character-search import; the value-driven import uses classifyPcCard + price.
 */
export function toPcCatalogCard(p: PcSearchProduct): PcCatalogCard | null {
  const card = classifyPcCard(p);
  if (!card) return null;
  const tags = parseProductName(p["product-name"] ?? "").tags;
  const special = tagRarity(tags) !== null || card.variant !== "normal" || card.category === "promo";
  return special ? card : null;
}
