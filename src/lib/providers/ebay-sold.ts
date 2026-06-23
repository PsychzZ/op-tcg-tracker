import type { Card } from "@prisma/client";
import type { Grade } from "@/domain/card";
import type { PriceProvider, ProviderPrice } from "./types";

function normalizeGrade(raw: string): Grade | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "RAW" || s === "UNGRADED") return "raw";
  if (s === "PSA9") return "psa9";
  if (s === "PSA10") return "psa10";
  return null;
}

interface EbaySoldShape {
  results?: Array<{
    grade: string;
    median: number;
    currency: string;
    sampleSize: number;
    sales?: Array<{ date: string; price: number; currency: string; url?: string }>;
  }>;
}

export function mapEbaySoldResponse(json: EbaySoldShape): ProviderPrice[] {
  const out: ProviderPrice[] = [];
  for (const row of json.results ?? []) {
    const grade = normalizeGrade(row.grade);
    if (!grade) continue;
    out.push({
      grade,
      priceNative: row.median,
      currency: row.currency,
      source: "ebaySold",
      sampleSize: row.sampleSize,
      observations: (row.sales ?? []).map((s) => ({
        saleDate: new Date(s.date),
        priceNative: s.price,
        currency: s.currency,
        url: s.url,
      })),
    });
  }
  return out;
}

export const ebaySoldProvider: PriceProvider = {
  name: "ebaySold",
  async getPrices(card: Card, _grades: Grade[]): Promise<ProviderPrice[]> {
    const base = process.env.EBAY_SOLD_BASE;
    const key = process.env.EBAY_SOLD_KEY;
    if (!base || !key) return []; // not configured yet → graceful no-op
    const query = `${card.name} ${card.number ?? ""} japanese`.trim();
    const res = await fetch(`${base}/sold?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    return mapEbaySoldResponse(await res.json());
  },
};
