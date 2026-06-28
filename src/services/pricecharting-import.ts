import { db } from "@/lib/db";
import { isTrackable } from "@/domain/card";
import { pcFetchJson } from "@/lib/providers/pricecharting";
import { toPcCatalogCard, type PcSearchProduct } from "@/domain/pricecharting-catalog";

const SEARCH_API = "https://www.pricecharting.com/api/products";

export interface PcImportResult {
  imported: number;
  skipped: number;
}

/** Search PriceCharting for products matching a free-text query (throttled + retried). */
export async function searchPriceCharting(query: string, token: string): Promise<PcSearchProduct[]> {
  const json = await pcFetchJson<{ products?: PcSearchProduct[] }>(
    `${SEARCH_API}?t=${encodeURIComponent(token)}&q=${encodeURIComponent(query)}`,
  );
  return json?.products ?? [];
}

/**
 * Run each query through PriceCharting, classify results into trackable Japanese special cards,
 * and upsert them (keyed by externalId). The PriceCharting product id is stored in providerIds so
 * the daily job can fetch live Raw prices.
 */
export async function importFromPriceCharting(queries: string[], token: string): Promise<PcImportResult> {
  let imported = 0;
  let skipped = 0;
  const seen = new Set<string>();

  for (const query of queries) {
    const products = await searchPriceCharting(query, token);
    for (const product of products) {
      const card = toPcCatalogCard(product);
      if (!card) {
        skipped++;
        continue;
      }
      if (seen.has(card.externalId)) continue;
      seen.add(card.externalId);
      if (!isTrackable({ ...card, trackOverride: null })) {
        skipped++;
        continue;
      }
      await db.card.upsert({
        where: { externalId: card.externalId },
        update: {
          name: card.name,
          setCode: card.setCode,
          number: card.number,
          rarity: card.rarity,
          variant: card.variant,
          category: card.category,
          providerIds: card.providerIds,
        },
        create: {
          externalId: card.externalId,
          name: card.name,
          setCode: card.setCode,
          number: card.number,
          rarity: card.rarity,
          variant: card.variant,
          category: card.category,
          language: card.language,
          providerIds: card.providerIds,
        },
      });
      imported++;
    }
  }

  return { imported, skipped };
}
