import "dotenv/config";
import { db } from "../src/lib/db";
import { pcSearchProducts } from "../src/lib/providers/pricecharting";
import { pickBestProduct, slugifyConsole } from "../src/domain/pricecharting-resolve";
import { extractPcImageUrl } from "../src/domain/pricecharting-image";

/**
 * Resolve owned/watched cards that have no PriceCharting id and/or no image yet — chiefly Western
 * promos/collabs (e.g. BVB Luffy) that live outside the `one-piece-japanese-*` sets. Stores the
 * product id + its console slug (so runPriceSync scrapes that set too) + the per-variant image.
 * Run: `npx tsx scripts/resolve-owned.ts`
 */
async function main() {
  const owned = await db.collectionItem.findMany({ select: { cardId: true } });
  const watch = await db.watchlistItem.findMany({ select: { cardId: true } });
  const ids = [...new Set([...owned.map((o) => o.cardId), ...watch.map((w) => w.cardId)])];
  const cards = await db.card.findMany({ where: { id: { in: ids } } });

  let resolved = 0;
  let imaged = 0;

  for (const card of cards) {
    const providerIds = (card.providerIds as Record<string, string> | null) ?? {};
    const hasId = Boolean(providerIds.priceCharting);
    const hasImage = Boolean(card.imageUrl);
    if (hasId && hasImage) continue;

    let pcId = providerIds.priceCharting ?? null;
    let consoleSlug = providerIds.priceChartingConsole ?? null;

    if (!pcId) {
      const query = [card.name, card.number].filter(Boolean).join(" ");
      let candidates = await pcSearchProducts(query);
      let best = pickBestProduct({ name: card.name, number: card.number }, candidates);
      if (!best) {
        candidates = await pcSearchProducts(card.name);
        best = pickBestProduct({ name: card.name, number: card.number }, candidates);
      }
      if (!best) {
        console.log(`  ✗ no match for "${card.name}" (${card.number ?? "—"})`);
        continue;
      }
      pcId = best.id;
      consoleSlug = slugifyConsole(best.consoleName);
      console.log(`  ✓ "${card.name}" → ${best.consoleName} | ${best.productName} (id ${pcId})`);
      resolved++;
    }

    let imageUrl = card.imageUrl;
    if (!imageUrl && pcId) {
      const res = await fetch(`https://www.pricecharting.com/offers?product=${pcId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) {
        imageUrl = extractPcImageUrl(await res.text(), 1600);
        if (imageUrl) imaged++;
      }
    }

    await db.card.update({
      where: { id: card.id },
      data: {
        imageUrl: imageUrl ?? undefined,
        providerIds: {
          ...providerIds,
          ...(pcId ? { priceCharting: pcId } : {}),
          ...(consoleSlug ? { priceChartingConsole: consoleSlug } : {}),
        },
      },
    });
  }

  console.log(`\nDone. Resolved ids: ${resolved}, backfilled images: ${imaged}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
