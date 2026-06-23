import type { Card } from "@prisma/client";
import type { Grade } from "@/domain/card";
import type { PriceProvider, ProviderPrice } from "./types";

function normalizeGrade(raw: string): Grade | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "RAW" || s === "UNGRADED" || s === "NM") return "raw";
  if (s === "PSA9") return "psa9";
  if (s === "PSA10") return "psa10";
  return null;
}

interface FreeApiShape {
  data?: Array<{ grade: string; price: number; currency: string }>;
}

export function mapFreeApiResponse(json: FreeApiShape): ProviderPrice[] {
  const out: ProviderPrice[] = [];
  for (const row of json.data ?? []) {
    const grade = normalizeGrade(row.grade);
    if (!grade) continue;
    out.push({ grade, priceNative: row.price, currency: row.currency, source: "freeApi" });
  }
  return out;
}

export const freeApiProvider: PriceProvider = {
  name: "freeApi",
  async getPrices(card: Card, _grades: Grade[]): Promise<ProviderPrice[]> {
    const base = process.env.FREE_API_BASE;
    const key = process.env.FREE_API_KEY;
    if (!base || !key) return []; // not configured yet → graceful no-op
    const ids = (card.providerIds as Record<string, string> | null) ?? {};
    const ref = ids.freeApi ?? card.externalId;
    const res = await fetch(`${base}/cards/${encodeURIComponent(ref ?? "")}/prices`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    return mapFreeApiResponse(await res.json());
  },
};
