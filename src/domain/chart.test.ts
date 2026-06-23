import { describe, it, expect } from "vitest";
import { buildPriceSeries, type SnapshotPoint } from "./chart";

describe("buildPriceSeries", () => {
  it("merges grades by date and sorts ascending", () => {
    const pts: SnapshotPoint[] = [
      { date: "2026-06-02", grade: "psa10", priceEur: 980 },
      { date: "2026-06-01", grade: "raw", priceEur: 200 },
      { date: "2026-06-01", grade: "psa10", priceEur: 950 },
    ];
    const series = buildPriceSeries(pts);
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ date: "2026-06-01", raw: 200, psa10: 950 });
    expect(series[1]).toEqual({ date: "2026-06-02", psa10: 980 });
  });
});
