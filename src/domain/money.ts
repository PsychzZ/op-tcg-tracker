export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatEur(n: number): string {
  return eur.format(n);
}
