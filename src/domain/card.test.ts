import { describe, it, expect } from "vitest";
import { isTrackable, type TrackableCard } from "./card";

function card(overrides: Partial<TrackableCard> = {}): TrackableCard {
  return {
    language: "ja",
    rarity: "SR",
    variant: "normal",
    category: "booster",
    trackOverride: null,
    ...overrides,
  };
}

describe("isTrackable", () => {
  it("tracks SR and SEC", () => {
    expect(isTrackable(card({ rarity: "SR" }))).toBe(true);
    expect(isTrackable(card({ rarity: "SEC" }))).toBe(true);
  });

  it("tracks SP and Leader", () => {
    expect(isTrackable(card({ rarity: "SP" }))).toBe(true);
    expect(isTrackable(card({ rarity: "L" }))).toBe(true);
  });

  it("does NOT track normal C / UC / R", () => {
    expect(isTrackable(card({ rarity: "C" }))).toBe(false);
    expect(isTrackable(card({ rarity: "UC" }))).toBe(false);
    expect(isTrackable(card({ rarity: "R" }))).toBe(false);
  });

  it("tracks special variants regardless of base rarity", () => {
    expect(isTrackable(card({ rarity: "C", variant: "altArt" }))).toBe(true);
    expect(isTrackable(card({ rarity: "R", variant: "mangaArt" }))).toBe(true);
    expect(isTrackable(card({ rarity: "UC", variant: "parallel" }))).toBe(true);
    expect(isTrackable(card({ rarity: "C", variant: "serial" }))).toBe(true);
  });

  it("tracks promos and special collabs", () => {
    expect(isTrackable(card({ rarity: "R", category: "promo" }))).toBe(true);
    expect(isTrackable(card({ rarity: "C", category: "specialCollab" }))).toBe(true);
  });

  it("never tracks non-Japanese cards (Rule #1, inviolable)", () => {
    expect(isTrackable(card({ language: "en", rarity: "SEC" }))).toBe(false);
    expect(isTrackable(card({ language: "en", trackOverride: true }))).toBe(false);
  });

  it("honors manual override for Japanese cards", () => {
    expect(isTrackable(card({ rarity: "C", trackOverride: true }))).toBe(true);
    expect(isTrackable(card({ rarity: "SEC", trackOverride: false }))).toBe(false);
  });
});
