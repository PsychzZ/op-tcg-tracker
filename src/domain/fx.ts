import { round2 } from "./money";

export type RatesPerEur = Record<string, number>;

/** rates are units of `currency` per 1 EUR (ECB convention). */
export function convertToEur(amount: number, currency: string, rates: RatesPerEur): number {
  if (currency === "EUR") return round2(amount);
  const rate = rates[currency];
  if (!rate) throw new Error(`No FX rate for ${currency}`);
  return round2(amount / rate);
}
