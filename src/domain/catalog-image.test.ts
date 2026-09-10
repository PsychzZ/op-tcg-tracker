import { describe, it, expect } from "vitest";
import { needsProviderImage } from "./catalog-image";

describe("needsProviderImage", () => {
  it("is false for a plain card with a standard set number (official art applies)", () => {
    expect(needsProviderImage("OP09-004", "normal")).toBe(false);
    expect(needsProviderImage("ST18-005", "normal")).toBe(false);
    expect(needsProviderImage("EB01-006", "normal")).toBe(false);
    expect(needsProviderImage("OP09-004", "normal")).toBe(false);
  });

  it("is true for any special variant, because the official art shows the base card", () => {
    expect(needsProviderImage("OP09-004", "altArt")).toBe(true);
    expect(needsProviderImage("OP09-004", "mangaArt")).toBe(true);
    expect(needsProviderImage("OP09-004", "parallel")).toBe(true);
    expect(needsProviderImage("OP09-004", "serial")).toBe(true);
  });

  it("is true when the number has no official image (promos, missing numbers)", () => {
    expect(needsProviderImage("P-063", "normal")).toBe(true);
    expect(needsProviderImage("P-BVB-001", "normal")).toBe(true);
    expect(needsProviderImage(null, "normal")).toBe(true);
    expect(needsProviderImage(undefined, "normal")).toBe(true);
    expect(needsProviderImage("DON!!", "normal")).toBe(true);
  });
});
