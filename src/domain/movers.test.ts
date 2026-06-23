import { describe, it, expect } from "vitest";
import { pctChange } from "./movers";

describe("pctChange", () => {
  it("computes percentage change", () => {
    expect(pctChange(100, 150)).toBe(50);
    expect(pctChange(100, 80)).toBe(-20);
  });
  it("returns null when base is non-positive", () => {
    expect(pctChange(0, 50)).toBeNull();
  });
});
