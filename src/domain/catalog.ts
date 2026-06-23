import type { Rarity, Variant, Category } from "./card";

export interface RawCatalogCard {
  externalId: string;
  name: string;
  nameJp?: string;
  rarity: string;
  language: string;
  setCode?: string;
  number?: string;
  imageUrl?: string;
  flags?: {
    altArt?: boolean;
    mangaArt?: boolean;
    parallel?: boolean;
    serial?: boolean;
    collab?: boolean;
  };
}

export interface CardInput {
  externalId: string;
  name: string;
  nameJp: string | null;
  setCode: string | null;
  number: string | null;
  rarity: Rarity;
  variant: Variant;
  category: Category;
  language: "ja";
  imageUrl: string | null;
}

export function normalizeRarity(input: string): Rarity | null {
  const s = input.trim().toUpperCase();
  if (["C", "COMMON"].includes(s)) return "C";
  if (["UC", "UNCOMMON"].includes(s)) return "UC";
  if (["R", "RARE"].includes(s)) return "R";
  if (["SR", "SUPER RARE"].includes(s)) return "SR";
  if (["SEC", "SECRET", "SECRET RARE"].includes(s)) return "SEC";
  if (["SP", "SP CARD", "SPECIAL", "SPECIAL CARD"].includes(s)) return "SP";
  if (["L", "LEADER"].includes(s)) return "L";
  return null;
}

export function detectVariant(raw: RawCatalogCard): Variant {
  const f = raw.flags ?? {};
  if (f.serial) return "serial";
  if (f.mangaArt) return "mangaArt";
  if (f.parallel) return "parallel";
  if (f.altArt) return "altArt";
  return "normal";
}

export function detectCategory(raw: RawCatalogCard): Category {
  if (raw.flags?.collab) return "specialCollab";
  const code = (raw.setCode ?? "").toUpperCase();
  if (code.startsWith("ST")) return "starter";
  if (code.startsWith("P-") || code.startsWith("PRB") || !code) return "promo";
  return "booster";
}

export function mapRawToCard(raw: RawCatalogCard): CardInput | null {
  if (raw.language !== "ja") return null;
  const rarity = normalizeRarity(raw.rarity);
  if (!rarity) return null;
  return {
    externalId: raw.externalId,
    name: raw.name,
    nameJp: raw.nameJp ?? null,
    setCode: raw.setCode ?? null,
    number: raw.number ?? null,
    rarity,
    variant: detectVariant(raw),
    category: detectCategory(raw),
    language: "ja",
    imageUrl: raw.imageUrl ?? null,
  };
}
