import { round2 } from "./money";

/** The terms of one recorded sale. Money is EUR per unit; `feesEur` is the total for the sale. */
export interface SaleTerms {
  quantity: number;
  soldPricePerUnit: number;
  feesEur?: number | null;
  costBasisPerUnit?: number | null;
}

export interface RealizedPnl {
  /** quantity × sold price */
  proceeds: number;
  fees: number;
  /** proceeds − fees (what actually landed) */
  net: number;
  /** quantity × cost basis, or null when the purchase price is unknown */
  cost: number | null;
  pnlEur: number | null;
  pnlPct: number | null;
}

/**
 * Realized profit/loss of one sale: net proceeds minus the cost basis.
 *
 * Without a known purchase price the euro figures stay null — guessing a cost would silently
 * invent profit, so callers show "unbekannt" instead.
 */
export function realizedPnl(sale: SaleTerms): RealizedPnl {
  const quantity = Math.max(0, Math.trunc(sale.quantity));
  const proceeds = round2(quantity * sale.soldPricePerUnit);
  const fees = round2(Math.max(0, sale.feesEur ?? 0));
  const net = round2(proceeds - fees);

  if (sale.costBasisPerUnit == null) {
    return { proceeds, fees, net, cost: null, pnlEur: null, pnlPct: null };
  }

  const cost = round2(quantity * sale.costBasisPerUnit);
  const pnlEur = round2(net - cost);
  const pnlPct = cost > 0 ? round2((pnlEur / cost) * 100) : null;
  return { proceeds, fees, net, cost, pnlEur, pnlPct };
}

export interface RealizedTotals {
  /** number of sale rows */
  count: number;
  /** cards sold in total */
  units: number;
  proceeds: number;
  fees: number;
  /** summed over sales with a known cost basis only */
  cost: number;
  /** summed over sales with a known cost basis only */
  pnlEur: number;
  pnlPct: number | null;
  /** sales excluded from `pnlEur` because the purchase price is unknown */
  unknownCostCount: number;
}

export function realizedTotals(sales: SaleTerms[]): RealizedTotals {
  let units = 0;
  let proceeds = 0;
  let fees = 0;
  let cost = 0;
  let pnlEur = 0;
  let unknownCostCount = 0;

  for (const sale of sales) {
    const pnl = realizedPnl(sale);
    units += Math.max(0, Math.trunc(sale.quantity));
    proceeds = round2(proceeds + pnl.proceeds);
    fees = round2(fees + pnl.fees);
    if (pnl.cost === null || pnl.pnlEur === null) {
      unknownCostCount++;
      continue;
    }
    cost = round2(cost + pnl.cost);
    pnlEur = round2(pnlEur + pnl.pnlEur);
  }

  return {
    count: sales.length,
    units,
    proceeds,
    fees,
    cost,
    pnlEur,
    pnlPct: cost > 0 ? round2((pnlEur / cost) * 100) : null,
    unknownCostCount,
  };
}
