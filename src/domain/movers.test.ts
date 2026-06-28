import { describe, it, expect } from "vitest";
import { pctChange, gradeDeltas } from "./movers";
import type { SnapshotPoint } from "./chart";

describe("pctChange", () => {
  it("computes percentage change", () => {
    expect(pctChange(100, 150)).toBe(50);
    expect(pctChange(100, 80)).toBe(-20);
  });
  it("returns null when base is non-positive", () => {
    expect(pctChange(0, 50)).toBeNull();
  });
});

describe("gradeDeltas", () => {
  const hist: SnapshotPoint[] = [
    { date: "2026-05-01", grade: "raw", priceEur: 100 },
    { date: "2026-06-01", grade: "raw", priceEur: 120 },
    { date: "2026-05-01", grade: "psa10", priceEur: 200 },
  ];

  it("computes percent change per grade over the window, from the latest date", () => {
    const d = gradeDeltas(hist, 60); // cutoff = 2026-04-02 → ref = 2026-05-01 (100) vs 120
    expect(d.raw).toBe(20);
  });

  it("uses the earliest point when all points fall inside the window", () => {
    const d = gradeDeltas(hist, 365);
    expect(d.raw).toBe(20);
  });

  it("returns null for grades with fewer than two points", () => {
    const d = gradeDeltas(hist, 30);
    expect(d.psa10).toBeNull();
    expect(d.psa9).toBeNull();
  });
});
