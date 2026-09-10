import { db } from "@/lib/db";
import { isTrackable } from "@/domain/card";
import { needsProviderImage } from "@/domain/catalog-image";
import { classifyPcCard, type PcCatalogCard } from "@/domain/pricecharting-catalog";
import { consoleSlugToName, parseConsoleRows, parseConsoleSlugs } from "@/domain/pricecharting-console";
import {
  PC_CATEGORY_URL,
  PC_CONSOLE_URL,
  fetchProductImageUrl,
  fetchText,
  sleep,
} from "@/lib/providers/pricecharting-scrape";

/** How many images one run fetches by default before deferring the rest to the next run. */
export const DEFAULT_MAX_IMAGE_FETCHES = 300;

export interface CatalogRefreshOptions {
  /** Only cards whose raw price is at least this many USD are imported (0 = no price filter). */
  minPriceUsd?: number;
  /** Stop after this many sets — handy for a quick sync or a smoke test. */
  maxSets?: number;
  /** Apply the design's trackability rule instead of importing every priced card. */
  respectTrackability?: boolean;
  /** Store the per-variant provider image for cards whose official art cannot be used. */
  fetchImages?: boolean;
  /**
   * Upper bound on image fetches per run. A full catalog needs a page per variant/promo card —
   * thousands of requests — so one run stays short and polite and the remainder is picked up by the
   * next run, since every stored image is kept. Set to 0 for no limit.
   */
  maxImageFetches?: number;
  /** Injectable for tests: (priceCharting product id) → image URL or null. */
  imageFetcher?: (pcProductId: string) => Promise<string | null>;
  /** Delay between set pages (PriceCharting rate-limits). */
  delayMs?: number;
}

export interface CatalogRefreshResult {
  sets: number;
  scanned: number;
  eligible: number;
  created: number;
  updated: number;
  imagesStored: number;
  /** Cards that still need a provider image but were deferred to a later run by the cap. */
  imagesSkipped: number;
  errors: string[];
}

/**
 * Upsert one classified card. `imageUrl` is only written when supplied, so a failed image fetch
 * never wipes a good one.
 */
export async function upsertCatalogCard(
  card: PcCatalogCard,
  imageUrl: string | null,
): Promise<"created" | "updated"> {
  const existing = await db.card.findUnique({
    where: { externalId: card.externalId },
    select: { id: true },
  });

  const data = {
    name: card.name,
    number: card.number,
    setCode: card.setCode,
    rarity: card.rarity,
    variant: card.variant,
    category: card.category,
    providerIds: card.providerIds,
    ...(imageUrl ? { imageUrl } : {}),
  };

  await db.card.upsert({
    where: { externalId: card.externalId },
    update: data,
    create: { externalId: card.externalId, language: card.language, ...data },
  });

  return existing ? "updated" : "created";
}

/**
 * Refresh the shared catalog from PriceCharting's Japanese category page.
 *
 * Every row goes through the canonical classifier (`classifyPcCard`) and — unless disabled — the
 * trackability rule, so what lands in the database is exactly what the app is allowed to track, with
 * the number, the set/category derived from that number, the variant, and an image that shows the
 * *right* art: the official per-number art is kept when it applies, and a per-variant provider image
 * is stored for alt-art/manga/parallel/serial and for promos, where the official URL cannot help.
 *
 * Runs weekly from `/api/cron/catalog` and manually via `npm run job:catalog`. Image fetching is
 * capped per run (`maxImageFetches`) so a full refresh converges over a few runs instead of
 * hammering the site for thousands of pages in one go.
 */
export async function refreshCatalog(options: CatalogRefreshOptions = {}): Promise<CatalogRefreshResult> {
  const {
    minPriceUsd = 11,
    maxSets,
    respectTrackability = true,
    fetchImages = true,
    maxImageFetches = DEFAULT_MAX_IMAGE_FETCHES,
    imageFetcher = fetchProductImageUrl,
    delayMs = 1200,
  } = options;

  const minCents = Math.round(minPriceUsd * 100);
  let imageFetches = 0;
  const result: CatalogRefreshResult = {
    sets: 0,
    scanned: 0,
    eligible: 0,
    created: 0,
    updated: 0,
    imagesStored: 0,
    imagesSkipped: 0,
    errors: [],
  };

  const slugs = parseConsoleSlugs(await fetchText(PC_CATEGORY_URL));
  const selected = maxSets ? slugs.slice(0, maxSets) : slugs;

  for (const slug of selected) {
    // Isolate each set: one unavailable page must not abort the whole refresh.
    try {
      const rows = parseConsoleRows(await fetchText(PC_CONSOLE_URL(slug)));
      const consoleName = consoleSlugToName(slug);
      result.sets++;
      result.scanned += rows.length;

      for (const row of rows) {
        if (row.loosePriceCents < minCents) continue;

        const card = classifyPcCard({
          id: row.id,
          "console-name": consoleName,
          "product-name": row.name,
        });
        if (!card) continue;
        if (respectTrackability && !isTrackable({ ...card, trackOverride: null })) continue;
        result.eligible++;

        const existing = await db.card.findUnique({
          where: { externalId: card.externalId },
          select: { id: true, imageUrl: true },
        });

        let imageUrl: string | null = null;
        if (fetchImages && needsProviderImage(card.number, card.variant) && !existing?.imageUrl) {
          const underCap = maxImageFetches === 0 || imageFetches < maxImageFetches;
          if (underCap) {
            imageFetches++;
            imageUrl = await imageFetcher(card.providerIds.priceCharting);
          } else {
            result.imagesSkipped++;
          }
        }

        const outcome = await upsertCatalogCard(card, imageUrl);
        if (outcome === "created") result.created++;
        else result.updated++;
        if (imageUrl) result.imagesStored++; // counted only once it is actually persisted
      }
    } catch (e) {
      result.errors.push(`${slug}:${String(e)}`);
    }

    await sleep(delayMs);
  }

  return result;
}
