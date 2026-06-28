import type { Card } from "@prisma/client";
import type { Grade, Variant, Rarity } from "@/domain/card";
import type { PriceProvider, ProviderPrice } from "./types";

const DEFAULT_ACTOR = "automation-lab~ebay-sold-scraper";

/** A sold-listing item from the Apify eBay sold scraper (automation-lab/ebay-sold-scraper). */
export interface EbaySoldItem {
  title?: string;
  soldPrice?: number; // final sold price in USD
  soldDate?: string;
  url?: string;
  itemUrl?: string;
  link?: string;
}

export interface MatchCriteria {
  number?: string | null;
  variant?: Variant;
  rarity?: Rarity;
}

const GRADE_RE: Record<"psa9" | "psa10", RegExp> = {
  psa10: /\bpsa\s*10\b/i,
  psa9: /\bpsa\s*9(\.5)?\b/i,
};

const ENGLISH_RE = /\b(en|eng|english)\b/i;
const ALT_ART_RE = /\balt(ernate|ernative)?\s*art\b/i;
const VARIANT_EXCLUDE_RE = /\bmanga\b|\balt(ernate|ernative)?\s*art\b|\bparallel\b|\banniversary\b|\bgold\b|\bsilver\b|\bspecial\b/i;

// Because many cards share one card number (base, manga-alt, anniversary, EN...), a sold listing
// only counts if it matches the card's number, variant, and is Japanese (English excluded).
function matchesCard(title: string, c: MatchCriteria): boolean {
  if (ENGLISH_RE.test(title)) return false;
  if (c.number) {
    const norm = title.replace(/#/g, "").toUpperCase();
    if (!norm.includes(c.number.toUpperCase())) return false;
  }
  switch (c.variant) {
    case "mangaArt":
      return /\bmanga\b/i.test(title);
    case "altArt":
      return ALT_ART_RE.test(title) && !/\bmanga\b/i.test(title);
    case "parallel":
      return /\bparallel\b/i.test(title) && !/\bmanga\b/i.test(title);
    case "serial":
      return /\b(serial|numbered)\b/i.test(title);
    default:
      // normal variant: discriminate by rarity so SP/SEC don't collapse onto the base SR.
      if (c.rarity === "SP") return /\bsp\b|special/i.test(title);
      if (c.rarity === "SEC") return /\b(sec|secret)\b/i.test(title);
      if (c.rarity === "L") return /\bleader\b/i.test(title);
      return !VARIANT_EXCLUDE_RE.test(title); // base (SR etc.): no special markers
  }
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Aggregate raw eBay sold items into a single ProviderPrice for a PSA grade: keep items whose title
 * matches the grade AND the card (number + variant + Japanese), take the median, count the sample.
 * Returns null for raw (covered by PriceCharting) or when no matching sales exist.
 */
export function aggregateEbaySoldItems(
  items: EbaySoldItem[],
  grade: Grade,
  criteria: MatchCriteria = {},
): ProviderPrice | null {
  if (grade !== "psa9" && grade !== "psa10") return null;
  const re = GRADE_RE[grade];
  const matched = items.filter(
    (it) =>
      typeof it.soldPrice === "number" &&
      it.soldPrice > 0 &&
      re.test(it.title ?? "") &&
      matchesCard(it.title ?? "", criteria),
  );
  if (matched.length === 0) return null;

  const prices = matched.map((it) => it.soldPrice as number);
  const observations = matched
    .filter((it) => it.soldDate)
    .map((it) => ({
      saleDate: new Date(it.soldDate as string),
      priceNative: it.soldPrice as number,
      currency: "USD",
      url: it.url ?? it.itemUrl ?? it.link,
    }))
    .filter((o) => !Number.isNaN(o.saleDate.getTime()));

  return {
    grade,
    priceNative: median(prices),
    currency: "USD",
    source: "ebaySold",
    sampleSize: matched.length,
    observations,
  };
}

const VARIANT_KW: Record<Variant, string> = {
  normal: "",
  altArt: "Alternate Art",
  mangaArt: "Manga Alternate Art",
  parallel: "Parallel",
  serial: "Serial",
};

export const ebaySoldProvider: PriceProvider = {
  name: "ebaySold",
  async getPrices(card: Card, grades: Grade[]): Promise<ProviderPrice[]> {
    const token = process.env.APIFY_TOKEN;
    if (!token) return []; // not configured → graceful no-op
    const actor = process.env.APIFY_EBAY_ACTOR ?? DEFAULT_ACTOR;
    const psaGrades = grades.filter((g): g is "psa9" | "psa10" => g === "psa9" || g === "psa10");
    if (psaGrades.length === 0) return [];

    const variant = card.variant as Variant;
    const rarity = card.rarity as Rarity;
    const rarityKw = variant === "normal" ? ({ SP: "SP", SEC: "SEC", L: "Leader" } as Record<string, string>)[rarity] ?? "" : "";
    const editionKw = VARIANT_KW[variant] || rarityKw;
    const ref = [card.name, card.number, editionKw, "Japanese"].filter(Boolean).join(" ");
    const searchQueries = psaGrades.map((g) => `${ref} ${g === "psa10" ? "PSA 10" : "PSA 9"}`);

    const res = await fetch(
      `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ searchQueries, maxListingsPerSearch: 25 }),
      },
    );
    if (!res.ok) return [];

    const items = (await res.json()) as EbaySoldItem[];
    const criteria: MatchCriteria = { number: card.number, variant, rarity };
    const out: ProviderPrice[] = [];
    for (const g of psaGrades) {
      const agg = aggregateEbaySoldItems(items, g, criteria);
      if (agg) out.push(agg);
    }
    return out;
  },
};
