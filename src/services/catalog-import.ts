import { db } from "@/lib/db";
import { isTrackable } from "@/domain/card";
import { mapRawToCard, type RawCatalogCard } from "@/domain/catalog";

export interface ImportResult {
  imported: number;
  skipped: number;
}

export async function importCatalog(rawCards: RawCatalogCard[]): Promise<ImportResult> {
  let imported = 0;
  let skipped = 0;

  for (const raw of rawCards) {
    const card = mapRawToCard(raw);
    if (!card || !isTrackable({ ...card, trackOverride: null })) {
      skipped++;
      continue;
    }
    await db.card.upsert({
      where: { externalId: card.externalId },
      update: {
        name: card.name,
        nameJp: card.nameJp,
        setCode: card.setCode,
        number: card.number,
        rarity: card.rarity,
        variant: card.variant,
        category: card.category,
        imageUrl: card.imageUrl,
      },
      create: card,
    });
    imported++;
  }

  return { imported, skipped };
}
