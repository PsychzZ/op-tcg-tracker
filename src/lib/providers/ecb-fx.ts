import type { RatesPerEur } from "@/domain/fx";

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const WANTED = ["USD", "JPY"];

/** Returns units of currency per 1 EUR, e.g. { USD: 1.08, JPY: 170.5 }. */
export async function fetchEcbRates(): Promise<RatesPerEur> {
  const res = await fetch(ECB_URL);
  if (!res.ok) throw new Error(`ECB fetch failed: ${res.status}`);
  const xml = await res.text();
  const rates: RatesPerEur = {};
  for (const cur of WANTED) {
    const m = xml.match(new RegExp(`currency=['"]${cur}['"]\\s+rate=['"]([0-9.]+)['"]`));
    if (m) rates[cur] = Number(m[1]);
  }
  if (Object.keys(rates).length === 0) throw new Error("No ECB rates parsed");
  return rates;
}
