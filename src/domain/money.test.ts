import { describe, it, expect } from "vitest";
import { round2, formatEur, parsePriceInput } from "./money";

describe("round2", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(99.999)).toBe(100);
  });
});

describe("formatEur", () => {
  it("formats euros in de-DE style", () => {
    const s = formatEur(1234.5);
    expect(s).toContain("€");
    expect(s).toContain("1.234");
  });
});

describe("parsePriceInput", () => {
  it("accepts German and US decimal input", () => {
    expect(parsePriceInput("1234.56")).toBe(1234.56);
    expect(parsePriceInput("1234,56")).toBe(1234.56);
    expect(parsePriceInput("1.234,56")).toBe(1234.56);
    expect(parsePriceInput("1,234.56")).toBe(1234.56);
  });

  it("ignores surrounding whitespace and rounds to cents", () => {
    expect(parsePriceInput("  120 ")).toBe(120);
    expect(parsePriceInput("99.999")).toBe(100);
  });

  it("returns null for empty, zero, negative or unparseable input", () => {
    expect(parsePriceInput("")).toBeNull();
    expect(parsePriceInput("   ")).toBeNull();
    expect(parsePriceInput("0")).toBeNull();
    expect(parsePriceInput("-5")).toBeNull();
    expect(parsePriceInput("abc")).toBeNull();
    expect(parsePriceInput("1.234.56")).toBeNull();
  });
});
