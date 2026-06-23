import { describe, it, expect } from "vitest";
import { round2, formatEur } from "./money";

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
