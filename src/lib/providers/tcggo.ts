import type { Card } from "@prisma/client";
import type { Grade } from "@/domain/card";
import type { PriceProvider, ProviderPrice } from "./types";

// Minimal shape we read (VERIFY against the real RapidAPI response on first key).
interface TcgGoCard {
  prices?: {
    tcg_player?: { currency?: string; market_price?: number };
    ebay?: { currency?: string; graded?: { psa?: Record<string, { median_price?: number; sample_size?: number }> } };
  };
}

/** Maps one TCGGO card object to our ProviderPrice[]: raw (market) + PSA 9/10 (eBay-sold). */
export function mapTcgGoResponse(card: TcgGoCard): ProviderPrice[] {
  const out: ProviderPrice[] = [];
  const market = card.prices?.tcg_player?.market_price;
  if (typeof market === "number") {
    out.push({
      grade: "raw",
      priceNative: market,
      currency: card.prices?.tcg_player?.currency ?? "USD",
      source: "freeApi",
    });
  }
  const psa = card.prices?.ebay?.graded?.psa ?? {};
  const ebayCur = card.prices?.ebay?.currency ?? "USD";
  for (const [grade, key] of [
    ["10", "psa10"],
    ["9", "psa9"],
  ] as const) {
    const g = psa[grade];
    if (g && typeof g.median_price === "number") {
      out.push({
        grade: key as Grade,
        priceNative: g.median_price,
        currency: ebayCur,
        source: "ebaySold",
        sampleSize: g.sample_size,
      });
    }
  }
  return out;
}

export const tcgGoProvider: PriceProvider = {
  name: "ebaySold",
  async getPrices(card: Card): Promise<ProviderPrice[]> {
    const base = process.env.TCGGO_BASE;
    const key = process.env.TCGGO_KEY;
    if (!base || !key) return []; // not configured → graceful no-op
    const host = process.env.TCGGO_HOST;
    // VERIFY: exact One Piece path/params against the RapidAPI docs once a key exists.
    const params = new URLSearchParams({ game: "one-piece", search: card.name, number: card.number ?? "" });
    const res = await fetch(`${base}/cards?${params.toString()}`, {
      headers: {
        "X-RapidAPI-Key": key,
        ...(host ? { "X-RapidAPI-Host": host } : {}),
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { data?: TcgGoCard[] } | TcgGoCard[];
    // Response may be an array or { data: [...] }; pick the first match. VERIFY.
    const list: TcgGoCard[] = Array.isArray(json) ? json : json.data ?? [];
    const first = list[0];
    return first ? mapTcgGoResponse(first) : [];
  },
};
