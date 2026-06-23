import { round2 } from "./money";

export function pctChange(oldValue: number, newValue: number): number | null {
  if (oldValue <= 0) return null;
  return round2(((newValue - oldValue) / oldValue) * 100);
}
