import { describe, it, expect } from "vitest";
import { normalizeRarity, detectVariant, detectCategory, mapRawToCard, type RawCatalogCard } from "./catalog";

function raw(o: Partial<RawCatalogCard> = {}): RawCatalogCard {
  return {
    externalId: "OP01-120",
    name: "Monkey D. Luffy",
    rarity: "SEC",
    language: "ja",
    setCode: "OP-01",
    number: "120",
    ...o,
  };
}

describe("normalizeRarity", () => {
  it("maps known rarities", () => {
    expect(normalizeRarity("SEC")).toBe("SEC");
    expect(normalizeRarity("Secret")).toBe("SEC");
    expect(normalizeRarity("SP CARD")).toBe("SP");
    expect(normalizeRarity("leader")).toBe("L");
  });
  it("returns null for unknown", () => {
    expect(normalizeRarity("DON")).toBeNull();
  });
});

describe("detectVariant", () => {
  it("detects special variants by priority", () => {
    expect(detectVariant(raw({ flags: { serial: true, parallel: true } }))).toBe("serial");
    expect(detectVariant(raw({ flags: { mangaArt: true } }))).toBe("mangaArt");
    expect(detectVariant(raw({ flags: { altArt: true } }))).toBe("altArt");
    expect(detectVariant(raw())).toBe("normal");
  });
});

describe("detectCategory", () => {
  it("classifies by set code and flags", () => {
    expect(detectCategory(raw({ setCode: "OP-01" }))).toBe("booster");
    expect(detectCategory(raw({ setCode: "ST-01" }))).toBe("starter");
    expect(detectCategory(raw({ setCode: "P-001" }))).toBe("promo");
    expect(detectCategory(raw({ setCode: undefined, flags: { collab: true } }))).toBe("specialCollab");
  });
});

describe("mapRawToCard", () => {
  it("maps a JP secret rare", () => {
    const card = mapRawToCard(raw());
    expect(card).not.toBeNull();
    expect(card!.rarity).toBe("SEC");
    expect(card!.language).toBe("ja");
    expect(card!.externalId).toBe("OP01-120");
  });
  it("drops non-Japanese cards", () => {
    expect(mapRawToCard(raw({ language: "en" }))).toBeNull();
  });
  it("drops unknown rarities", () => {
    expect(mapRawToCard(raw({ rarity: "DON" }))).toBeNull();
  });
});
