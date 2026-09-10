import { describe, it, expect } from "vitest";
import {
  isJapaneseOnePiece,
  parseProductName,
  classifyPcCard,
  toPcCatalogCard,
  type PcSearchProduct,
} from "./pricecharting-catalog";

describe("isJapaneseOnePiece", () => {
  it("accepts Japanese One Piece consoles only", () => {
    expect(isJapaneseOnePiece("One Piece Japanese Carrying on His Will")).toBe(true);
    expect(isJapaneseOnePiece("One Piece Japanese Promo")).toBe(true);
    expect(isJapaneseOnePiece("One Piece Carrying on His Will")).toBe(false); // English
    expect(isJapaneseOnePiece("Pokemon Japanese Base Set")).toBe(false); // not One Piece
  });
});

describe("parseProductName", () => {
  it("extracts base name, card number, and bracket tags", () => {
    const r = parseProductName("Ace & Sabo & Luffy [Alternate Art] OP13-007");
    expect(r.number).toBe("OP13-007");
    expect(r.tags).toEqual(["Alternate Art"]);
    expect(r.baseName).toBe("Ace & Sabo & Luffy");
  });
  it("handles a tagged starter card", () => {
    const r = parseProductName("Luffy-Tarou [SP] ST18-005");
    expect(r.number).toBe("ST18-005");
    expect(r.tags).toEqual(["SP"]);
    expect(r.baseName).toBe("Luffy-Tarou");
  });
});

describe("toPcCatalogCard", () => {
  const make = (id: string, consoleName: string, productName: string): PcSearchProduct => ({
    id,
    "console-name": consoleName,
    "product-name": productName,
  });

  it("classifies a Japanese SP card", () => {
    const c = toPcCatalogCard(make("9744444", "One Piece Japanese Fist of Divine Speed", "Luffy-Tarou [SP] ST18-005"));
    expect(c).toMatchObject({
      externalId: "pc-9744444",
      name: "Luffy-Tarou",
      number: "ST18-005",
      setCode: "ST18",
      rarity: "SP",
      variant: "normal",
      category: "starter",
      language: "ja",
      providerIds: { priceCharting: "9744444" },
    });
  });

  it("classifies a Japanese alternate-art card (variant makes it trackable)", () => {
    const c = toPcCatalogCard(make("10349223", "One Piece Japanese Carrying on His Will", "Ace & Sabo & Luffy [Alternate Art] OP13-007"));
    expect(c?.variant).toBe("altArt");
    expect(c?.setCode).toBe("OP13");
    expect(c?.category).toBe("booster");
  });

  it("keeps a numbered anniversary variant inside its set (OP12), not the Promo bucket", () => {
    const c = classifyPcCard(make("11501755", "One Piece Japanese Promo", "Luffy Is The Man [3rd Anniversary] OP12-039"));
    expect(c?.category).toBe("booster");
    expect(c?.setCode).toBe("OP12");
    expect(c?.number).toBe("OP12-039");
  });

  it("classifies a true P-numbered promo into the promo bucket (no set code)", () => {
    const c = classifyPcCard(make("10718094", "One Piece Japanese Promo", "Jinbe P-063"));
    expect(c?.category).toBe("promo");
    expect(c?.setCode).toBeNull();
    expect(c?.number).toBe("P-063");
  });

  it("skips sealed products (no card number)", () => {
    expect(classifyPcCard(make("8508896", "One Piece Japanese Romance Dawn", "Booster Box"))).toBeNull();
  });

  it("skips English (non-Japanese) cards", () => {
    expect(toPcCatalogCard(make("9037915", "One Piece Fist of Divine Speed", "Luffy-Tarou [SP] ST18-005"))).toBeNull();
  });

  it("skips plain base cards with no special rarity/variant/promo", () => {
    expect(toPcCatalogCard(make("10349222", "One Piece Japanese Carrying on His Will", "Ace & Sabo & Luffy OP13-007"))).toBeNull();
  });

  it("skips DON!! cards", () => {
    expect(toPcCatalogCard(make("10619168", "One Piece Japanese Premium Booster 2", "DON!! Card [Luffy Gear 5 Gold]"))).toBeNull();
  });
});

describe("variant detection", () => {
  const make = (id: string, productName: string): PcSearchProduct => ({
    id,
    "console-name": "One Piece Japanese Carrying on His Will",
    "product-name": productName,
  });

  it("reads variant markers spelled out in the name, not just bracket tags", () => {
    expect(classifyPcCard(make("1", "Monkey D. Luffy (Alternate Art) OP01-003"))?.variant).toBe("altArt");
    expect(classifyPcCard(make("2", "Trafalgar Law Manga OP01-002"))?.variant).toBe("mangaArt");
    expect(classifyPcCard(make("3", "Nami [Parallel] OP01-016"))?.variant).toBe("parallel");
    expect(classifyPcCard(make("4", "Shanks Serial Numbered OP01-004"))?.variant).toBe("serial");
    expect(classifyPcCard(make("5", "Roronoa Zoro OP01-025"))?.variant).toBe("normal");
  });

  it("still honours bracket tags", () => {
    expect(classifyPcCard(make("6", "Ace & Sabo & Luffy [Alternate Art] OP13-007"))?.variant).toBe("altArt");
    expect(classifyPcCard(make("7", "Luffy-Tarou [SP] ST18-005"))?.variant).toBe("normal");
  });

  it("keeps the number and the set/category derived from it", () => {
    const c = classifyPcCard(make("8", "Monkey D. Luffy (Alternate Art) OP01-003"));
    expect(c?.number).toBe("OP01-003");
    expect(c?.setCode).toBe("OP01");
    expect(c?.category).toBe("booster");
    expect(c?.rarity).toBe("SR"); // no explicit tag → inferred, not invented per variant
  });
});
