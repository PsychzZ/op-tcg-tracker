import "dotenv/config";
import { db } from "../src/lib/db";
import { deriveCard } from "../src/domain/card-set";

/**
 * One-off cleanup: recompute setCode/category from each card's number (the source of truth), and
 * remove rows that aren't trackable singles — sealed products ("Booster Box", "Sealed Deck", …) and
 * old test junk. Owned/watched cards are never deleted (guarded). Run: `npx tsx scripts/normalize-catalog.ts`
 */
async function main() {
  const cards = await db.card.findMany();
  const owned = new Set((await db.collectionItem.findMany({ select: { cardId: true } })).map((c) => c.cardId));
  const watched = new Set((await db.watchlistItem.findMany({ select: { cardId: true } })).map((c) => c.cardId));

  let updated = 0;
  let deleted = 0;
  let kept = 0;

  for (const c of cards) {
    const d = deriveCard(c.name, c.number, c.category);

    if (!d) {
      if (owned.has(c.id) || watched.has(c.id)) {
        console.log(`  ! keeping owned/watched non-single: "${c.name}" (${c.id})`);
        kept++;
        continue;
      }
      // Remove dependents first (FK), then the card.
      await db.$transaction([
        db.priceSnapshot.deleteMany({ where: { cardId: c.id } }),
        db.saleObservation.deleteMany({ where: { cardId: c.id } }),
        db.watchlistItem.deleteMany({ where: { cardId: c.id } }),
        db.collectionItem.deleteMany({ where: { cardId: c.id } }),
        db.card.delete({ where: { id: c.id } }),
      ]);
      deleted++;
      continue;
    }

    if (d.number !== c.number || d.setCode !== c.setCode || d.category !== c.category) {
      await db.card.update({
        where: { id: c.id },
        data: { number: d.number, setCode: d.setCode, category: d.category },
      });
      updated++;
    }
  }

  console.log(`\nDone. updated ${updated}, deleted ${deleted}, kept-non-single ${kept}`);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
