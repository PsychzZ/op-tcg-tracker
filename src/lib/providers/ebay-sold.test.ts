import { describe, it, expect } from "vitest";
import { aggregateEbaySoldItems, type EbaySoldItem } from "./ebay-sold";

// REAL Apify output for "Shanks OP09-004 PSA 10" — one card number spans many distinct cards
// (base SR, Manga-Alt, anniversary, SP-Silver, English). The aggregator must disambiguate.
const items: EbaySoldItem[] = [
  { title: "[PSA 10] Shanks ONE PIECE Card Game OP09-004 Emperors in the New World", soldPrice: 199.99, soldDate: "Jan 13, 2026", url: "https://ebay.com/itm/1" },
  { title: "PSA10 Shanks OP09-004 Manga Alt Art comic parallel The Emperors of the New World", soldPrice: 1893.9, soldDate: "Jun 27, 2026" },
  { title: "2025 One Piece Japanese Shanks 3rd Anniversary Gold #OP09-004 PSA 10 GEM MINT", soldPrice: 1415, soldDate: "Jun 26, 2026" },
  { title: "2024 One Piece Shanks Wanted Poster Alternate Art OP09-004 EN PSA 10 Gem Mint", soldPrice: 395 },
  { title: "PSA10 2024 SHANKS MANGA ALTERNATE ART OP09-004 JAPAN", soldPrice: 710, soldDate: "Dec 24, 2025" },
  { title: "PSA 10 Shanks OP09-004 SR Emperors in the New World - ONE PIECE Card Japanese", soldPrice: 125, soldDate: "Jun 24, 2026" },
  { title: "One Piece PSA 10 Shanks Wanted OP09-004 Emperors in the New World", soldPrice: 344.8, soldDate: "Jun 21, 2026" },
  { title: "One Piece Shanks OP09-004 Manga Alternative Art Emperors in the New World PSA 10", soldPrice: 3150, soldDate: "Jun 22, 2026" },
  { title: "Shanks OP09-004 (SP) (Silver) OP09-004 Carrying On His Will Foil PSA 10", soldPrice: 1575 },
  { title: "2025 One Piece Carrying On His Will Shanks Special Card Silver #OP09-004 PSA 10", soldPrice: 1600 },
  { title: "Shanks OP09-004 SR Alt Art Emperors in the New World - PSA 10 Gem Mint", soldPrice: 132 },
];

describe("aggregateEbaySoldItems", () => {
  it("isolates the base SR JP card — excludes manga/anniversary/silver/SP/EN", () => {
    const r = aggregateEbaySoldItems(items, "psa10", { number: "OP09-004", variant: "normal", rarity: "SR" })!;
    expect(r.sampleSize).toBe(3); // 199.99, 125, 344.8
    expect(r.priceNative).toBe(199.99); // median
    expect(r.source).toBe("ebaySold");
  });

  it("isolates the SP (Silver/Special) variant by rarity", () => {
    const r = aggregateEbaySoldItems(items, "psa10", { number: "OP09-004", variant: "normal", rarity: "SP" })!;
    expect(r.sampleSize).toBe(2); // 1575, 1600
    expect(r.priceNative).toBe(1587.5);
  });

  it("isolates the Manga-Alt variant", () => {
    const r = aggregateEbaySoldItems(items, "psa10", { number: "OP09-004", variant: "mangaArt" })!;
    expect(r.sampleSize).toBe(3); // 710, 1893.9, 3150
    expect(r.priceNative).toBe(1893.9);
  });

  it("isolates the (non-manga) Alternate-Art variant, excluding English", () => {
    const r = aggregateEbaySoldItems(items, "psa10", { number: "OP09-004", variant: "altArt" })!;
    expect(r.sampleSize).toBe(1); // only the JP SR Alt Art (the EN Wanted alt-arts are excluded)
    expect(r.priceNative).toBe(132);
  });

  it("returns null for raw and when nothing matches", () => {
    expect(aggregateEbaySoldItems(items, "raw", { number: "OP09-004" })).toBeNull();
    expect(aggregateEbaySoldItems(items, "psa10", { number: "ZZ99-999", variant: "normal" })).toBeNull();
  });
});
