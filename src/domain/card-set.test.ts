import { describe, it, expect } from "vitest";
import { parseCardNumber, deriveCard, sectionFor } from "./card-set";

describe("parseCardNumber", () => {
  it("reads a set number from the number field", () => {
    expect(parseCardNumber("Roronoa Zoro", "OP07-113")).toBe("OP07-113");
  });
  it("recovers a number embedded in the name", () => {
    expect(parseCardNumber("Jinbe P-063", null)).toBe("P-063");
    expect(parseCardNumber("Borsalino OP16-099 [Manga]", null)).toBe("OP16-099");
  });
  it("handles the promo P-xxx / collab P-BVB-001 formats", () => {
    expect(parseCardNumber("Monkey D. Luffy x BVB", "P-BVB-001")).toBe("P-BVB-001");
    expect(parseCardNumber("Promo Luffy", "P-001")).toBe("P-001");
  });
  it("returns null for sealed products and junk", () => {
    expect(parseCardNumber("Booster Box", null)).toBeNull();
    expect(parseCardNumber("Monkey D. Luffy", "120")).toBeNull();
  });
});

describe("deriveCard", () => {
  it("keeps a promo-tagged set card inside its numbered booster set", () => {
    expect(deriveCard("Roronoa Zoro", "OP07-113", "promo")).toEqual({
      number: "OP07-113",
      setCode: "OP07",
      category: "booster",
    });
  });
  it("routes ST numbers to starter, EB/PRB to booster", () => {
    expect(deriveCard("Luffy", "ST13-003", "promo")?.category).toBe("starter");
    expect(deriveCard("Luffy", "ST13-003", "promo")?.setCode).toBe("ST13");
    expect(deriveCard("Sanji", "EB01-001", "booster")?.category).toBe("booster");
    expect(deriveCard("Zoro", "PRB02-001", "booster")?.setCode).toBe("PRB02");
  });
  it("buckets P-xxx promos with null setCode", () => {
    expect(deriveCard("Jinbe P-063", null, "booster")).toEqual({
      number: "P-063",
      setCode: null,
      category: "promo",
    });
  });
  it("preserves specialCollab identity", () => {
    expect(deriveCard("Monkey D. Luffy x BVB", "P-BVB-001", "specialCollab")).toEqual({
      number: "P-BVB-001",
      setCode: null,
      category: "specialCollab",
    });
  });
  it("returns null when no number is present (sealed product)", () => {
    expect(deriveCard("Booster Box", null, "booster")).toBeNull();
  });
});

describe("sectionFor", () => {
  it("derives the section from the set code, not the per-card category", () => {
    expect(sectionFor("OP07", "promo")).toBe("booster");
    expect(sectionFor("ST13", "promo")).toBe("starter");
    expect(sectionFor("EB01", "promo")).toBe("booster");
  });
  it("falls back to category for bucket (null-setCode) groups", () => {
    expect(sectionFor(null, "promo")).toBe("promo");
    expect(sectionFor(null, "specialCollab")).toBe("specialCollab");
  });
});
