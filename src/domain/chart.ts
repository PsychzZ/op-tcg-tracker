import type { Grade } from "./card";

export interface SnapshotPoint {
  date: string; // YYYY-MM-DD
  grade: Grade;
  priceEur: number;
}

export interface SeriesPoint {
  date: string;
  raw?: number;
  psa9?: number;
  psa10?: number;
}

export function buildPriceSeries(points: SnapshotPoint[]): SeriesPoint[] {
  const byDate = new Map<string, SeriesPoint>();
  for (const p of points) {
    const entry = byDate.get(p.date) ?? { date: p.date };
    entry[p.grade] = p.priceEur;
    byDate.set(p.date, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
