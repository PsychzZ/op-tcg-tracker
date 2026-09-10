import "dotenv/config";
import { db } from "../src/lib/db";

/**
 * Prune the catalog down to cards worth tracking: delete any card whose best grade price is below
 * the threshold, OR that has no image, OR that never got a price (all "cheap/incomplete" signals).
 * Owned/watched cards are always kept. Run: `npx tsx scripts/prune-catalog.ts [--threshold=10]`
 */
const arg = process.argv.find((a) => a.startsWith("--threshold="));
const THRESHOLD = arg ? Number(arg.split("=")[1]) : 10;

async function main() {
  const cards = await db.card.findMany({ select: { id: true, imageUrl: true } });
  const owned = new Set((await db.collectionItem.findMany({ select: { cardId: true } })).map((c) => c.cardId));
  const watched = new Set((await db.watchlistItem.findMany({ select: { cardId: true } })).map((c) => c.cardId));
  // Cards the user sold are kept as well: the Sale row carries the realized P/L and its FK would
  // block the delete anyway.
  const sold = new Set((await db.sale.findMany({ select: { cardId: true } })).map((s) => s.cardId));

  // Best (max) latest grade price per card.
  const snaps = await db.priceSnapshot.findMany({ select: { cardId: true, priceEur: true } });
  const maxPrice = new Map<string, number>();
  for (const s of snaps) maxPrice.set(s.cardId, Math.max(maxPrice.get(s.cardId) ?? 0, Number(s.priceEur)));

  let deleted = 0;
  for (const c of cards) {
    const cheap = (maxPrice.get(c.id) ?? 0) < THRESHOLD;
    const noImage = !c.imageUrl;
    if (!(cheap || noImage)) continue;
    if (owned.has(c.id) || watched.has(c.id) || sold.has(c.id)) continue; // never delete what the user holds or sold

    await db.$transaction([
      db.priceSnapshot.deleteMany({ where: { cardId: c.id } }),
      db.saleObservation.deleteMany({ where: { cardId: c.id } }),
      db.watchlistItem.deleteMany({ where: { cardId: c.id } }),
      db.collectionItem.deleteMany({ where: { cardId: c.id } }),
      db.card.delete({ where: { id: c.id } }),
    ]);
    deleted++;
  }

  const remaining = await db.card.count();
  console.log(`Done. threshold €${THRESHOLD} | deleted ${deleted} | remaining ${remaining}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
