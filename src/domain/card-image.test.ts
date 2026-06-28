import { describe, it, expect } from "vitest";
import { cardImageUrl, officialCardImageUrl } from "./card-image";

describe("officialCardImageUrl (upstream)", () => {
  it("builds the official JP image URL for standard numbers", () => {
    expect(officialCardImageUrl("OP09-004")).toBe("https://www.onepiece-cardgame.com/images/cardlist/card/OP09-004.png");
    expect(officialCardImageUrl("st18-005")).toBe("https://www.onepiece-cardgame.com/images/cardlist/card/ST18-005.png");
  });
  it("returns null for promos / non-standard / empty", () => {
    expect(officialCardImageUrl("P-BVB-001")).toBeNull();
    expect(officialCardImageUrl(null)).toBeNull();
  });
});

describe("cardImageUrl (browser proxy)", () => {
  it("returns a same-origin proxy path with the normalized number", () => {
    expect(cardImageUrl("OP09-004")).toBe("/api/card-image/OP09-004");
    expect(cardImageUrl("st18-005")).toBe("/api/card-image/ST18-005");
  });
  it("returns null for promos / non-standard / empty", () => {
    expect(cardImageUrl("P-112")).toBeNull();
    expect(cardImageUrl(undefined)).toBeNull();
  });
});
