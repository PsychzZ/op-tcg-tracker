import { describe, it, expect } from "vitest";
import { pickBestProduct, slugifyConsole, type ResolveCandidate } from "./pricecharting-resolve";

const bvbCandidates: ResolveCandidate[] = [
  { id: "9142504", consoleName: "One Piece Ultra Deck: The Three Brothers", productName: "Monkey.D.Luffy [BVB Promo] ST13-003" },
  { id: "6943598", consoleName: "One Piece Ultra Deck: The Three Brothers", productName: "Monkey.D.Luffy ST13-003" },
  { id: "8509206", consoleName: "One Piece Japanese Ultra Deck: The Three Brothers", productName: "Monkey.D.Luffy ST13-003" },
  { id: "7469843", consoleName: "Funko POP Animation", productName: "Monkey D. Luffy #1771" },
  { id: "10123134", consoleName: "LEGO BrickHeadz", productName: "Monkey D. Luffy #40799" },
];

describe("slugifyConsole", () => {
  it("slugifies a console name into a /console/ slug", () => {
    expect(slugifyConsole("One Piece Ultra Deck: The Three Brothers")).toBe("one-piece-ultra-deck-the-three-brothers");
  });
});

describe("pickBestProduct", () => {
  it("picks the distinctive BVB variant over plain Luffy and over Funko/LEGO", () => {
    const best = pickBestProduct({ name: "Monkey D. Luffy x BVB", number: "P-BVB-001" }, bvbCandidates);
    expect(best?.id).toBe("9142504");
  });

  it("ignores non-One-Piece products entirely", () => {
    const best = pickBestProduct({ name: "Monkey D. Luffy", number: null }, [
      { id: "1", consoleName: "Funko POP Animation", productName: "Monkey D. Luffy #1771" },
      { id: "2", consoleName: "LEGO BrickHeadz", productName: "Monkey D. Luffy #40799" },
    ]);
    expect(best).toBeNull();
  });

  it("uses the card number as a strong signal and prefers Japanese on a tie", () => {
    const best = pickBestProduct({ name: "Trafalgar Law", number: "OP01-013" }, [
      { id: "a", consoleName: "One Piece Romance Dawn", productName: "Trafalgar Law OP01-013" },
      { id: "b", consoleName: "One Piece Japanese Romance Dawn", productName: "Trafalgar Law OP01-013" },
    ]);
    expect(best?.id).toBe("b");
  });

  it("returns null when nothing matches", () => {
    expect(pickBestProduct({ name: "Zoro", number: null }, bvbCandidates)).toBeNull();
  });
});
