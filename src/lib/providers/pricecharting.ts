import type { Card } from "@prisma/client";
import type { Grade } from "@/domain/card";
import type { ResolveCandidate } from "@/domain/pricecharting-resolve";
import type { PriceProvider, ProviderPrice } from "./types";

const API = "https://www.pricecharting.com/api/product";
const SEARCH = "https://www.pricecharting.com/api/products";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// PriceCharting allows ~30 requests before returning 429 (then refills quickly). We serialize
// every call through a queue with a minimum gap (~30/min) and retry on 429/5xx, so a daily run
// over hundreds of cards never silently drops prices to rate limiting.
const MIN_GAP_MS = 2100;
let lastCallAt = 0;
let queue: Promise<unknown> = Promise.resolve();

export async function pcFetchJson<T = unknown>(url: string): Promise<T | null> {
  const task = queue.then(async () => {
    for (let attempt = 0; attempt < 5; attempt++) {
      const since = Date.now() - lastCallAt;
      if (since < MIN_GAP_MS) await sleep(MIN_GAP_MS - since);
      lastCallAt = Date.now();
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as T;
      if (res.status === 429 || res.status >= 500) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      return null; // 404 and other client errors: no point retrying
    }
    return null;
  });
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}

/**
 * PriceCharting product response. Prices are integer cents in USD.
 * Card grade columns map as: loose-price → Ungraded (raw); graded-price → Grade 9 (PSA 9);
 * manual-only-price → PSA 10. The Collector tier returns only loose-price; the graded
 * fields appear automatically on the Legendary tier, so mapping them now future-proofs us.
 */
interface PriceChartingProduct {
  "loose-price"?: number;
  "graded-price"?: number;
  "manual-only-price"?: number;
  status?: string;
}

const centsToUnits = (cents: number): number => Math.round(cents) / 100;

export function mapPriceChartingResponse(json: PriceChartingProduct): ProviderPrice[] {
  const out: ProviderPrice[] = [];
  const push = (grade: Grade, cents: number | undefined) => {
    if (typeof cents === "number" && cents > 0) {
      out.push({ grade, priceNative: centsToUnits(cents), currency: "USD", source: "priceCharting" });
    }
  };
  push("raw", json["loose-price"]);
  push("psa9", json["graded-price"]);
  push("psa10", json["manual-only-price"]);
  return out;
}

/**
 * Search PriceCharting products by free-text query (name / number). Returns candidates for
 * `pickBestProduct`. Includes non-Japanese results (Western promos/collabs) on purpose.
 */
export async function pcSearchProducts(query: string): Promise<ResolveCandidate[]> {
  const token = process.env.PRICECHARTING_TOKEN;
  if (!token) return [];
  const json = await pcFetchJson<{ products?: Array<Record<string, unknown>> }>(
    `${SEARCH}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}`,
  );
  return (json?.products ?? []).map((p) => ({
    id: String(p.id),
    consoleName: String(p["console-name"] ?? ""),
    productName: String(p["product-name"] ?? ""),
  }));
}

export const priceChartingProvider: PriceProvider = {
  name: "priceCharting",
  async getPrices(card: Card): Promise<ProviderPrice[]> {
    const token = process.env.PRICECHARTING_TOKEN;
    if (!token) return []; // not configured → graceful no-op
    const ids = (card.providerIds as Record<string, string> | null) ?? {};
    const id = ids.priceCharting;
    if (!id) return []; // no PriceCharting mapping for this card yet → skip
    const json = await pcFetchJson<PriceChartingProduct>(
      `${API}?t=${encodeURIComponent(token)}&id=${encodeURIComponent(id)}`,
    );
    if (!json) return [];
    return mapPriceChartingResponse(json);
  },
};
