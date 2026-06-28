import { round2 } from "./money";
import type { Grade } from "./card";
import type { SnapshotPoint } from "./chart";

export function pctChange(oldValue: number, newValue: number): number | null {
  if (oldValue <= 0) return null;
  return round2(((newValue - oldValue) / oldValue) * 100);
}

const GRADES: Grade[] = ["raw", "psa9", "psa10"];

/** Percent change per grade over the last `days`, measured back from the latest snapshot date. */
export function gradeDeltas(history: SnapshotPoint[], days: number): Record<Grade, number | null> {
  const out: Record<Grade, number | null> = { raw: null, psa9: null, psa10: null };
  for (const grade of GRADES) {
    const pts = history.filter((p) => p.grade === grade).sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length < 2) continue;
    const latest = pts[pts.length - 1];
    const cutoff = new Date(latest.date);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const older = [...pts].reverse().find((p) => p.date <= cutoffIso);
    const ref = older ?? pts[0];
    if (ref.date === latest.date) continue;
    out[grade] = pctChange(ref.priceEur, latest.priceEur);
  }
  return out;
}
