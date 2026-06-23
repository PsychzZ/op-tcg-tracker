import { describe, it, expect } from "vitest";
import { convertToEur, type RatesPerEur } from "./fx";

const rates: RatesPerEur = { USD: 1.08, JPY: 170 };

describe("convertToEur", () => {
  it("passes EUR through unchanged", () => {
    expect(convertToEur(100, "EUR", rates)).toBe(100);
  });
  it("converts USD using rate (currency per 1 EUR)", () => {
    expect(convertToEur(108, "USD", rates)).toBe(100);
  });
  it("converts JPY", () => {
    expect(convertToEur(1700, "JPY", rates)).toBe(10);
  });
  it("throws for an unknown currency", () => {
    expect(() => convertToEur(10, "GBP", rates)).toThrow();
  });
});
