import { round2 } from "./money";
import type { Grade } from "./card";

export interface OwnedItem {
  grade: Grade;
  quantity: number;
  purchasePricePerUnit: number | null;
}

export interface Pnl {
  value: number;
  cost: number | null;
  pnlEur: number | null;
  pnlPct: number | null;
}

export function holdingPnl(item: OwnedItem, currentPriceEur: number): Pnl {
  const value = round2(item.quantity * currentPriceEur);
  if (item.purchasePricePerUnit == null) {
    return { value, cost: null, pnlEur: null, pnlPct: null };
  }
  const cost = round2(item.quantity * item.purchasePricePerUnit);
  const pnlEur = round2(value - cost);
  const pnlPct = cost > 0 ? round2((pnlEur / cost) * 100) : null;
  return { value, cost, pnlEur, pnlPct };
}

export type GradeTotals = Record<Grade, number>;

export function portfolioTotals(items: OwnedItem[], priceByGrade: GradeTotals): GradeTotals {
  const totals: GradeTotals = { raw: 0, psa9: 0, psa10: 0 };
  for (const item of items) {
    const price = priceByGrade[item.grade] ?? 0;
    totals[item.grade] = round2(totals[item.grade] + item.quantity * price);
  }
  return totals;
}
