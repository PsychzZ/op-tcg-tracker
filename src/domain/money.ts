export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatEur(n: number): string {
  return eur.format(n);
}

/**
 * Parses a user-typed price into a positive EUR amount. Both decimal conventions are accepted:
 * "1.234,56" / "1234,56" (German) and "1234.56" / "1,234.56" (US) — when both separators appear,
 * the one written last is the decimal separator.
 *
 * A lone separator followed by exactly three digits ("1.234") is ambiguous, and is read as a
 * decimal point (1.234 ≈ 1,23 €). Type the cents explicitly when a thousands separator is meant.
 * Returns null for empty, unparseable or non-positive input (callers treat null as "clear").
 */
export function parsePriceInput(raw: string): number | null {
  const text = raw.trim().replace(/\s/g, "");
  if (text === "") return null;

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");
  let normalized = text;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastComma > lastDot
        ? text.replace(/\./g, "").replace(",", ".")
        : text.replace(/,/g, "");
  } else if (lastComma >= 0) {
    normalized = text.replace(",", ".");
  }

  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) return null;
  return round2(value);
}
