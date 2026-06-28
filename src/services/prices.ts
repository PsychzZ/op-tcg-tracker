import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";
import type { SnapshotPoint } from "@/domain/chart";

/** Latest price (EUR) per grade for a single card. */
export async function getLatestPriceMap(cardId: string): Promise<Record<Grade, number>> {
  const rows = await db.priceSnapshot.findMany({
    where: { cardId },
    orderBy: { date: "desc" },
  });
  const map: Record<Grade, number> = { raw: 0, psa9: 0, psa10: 0 };
  const seen = new Set<Grade>();
  for (const r of rows) {
    if (!seen.has(r.grade)) {
      map[r.grade] = Number(r.priceEur);
      seen.add(r.grade);
    }
  }
  return map;
}

/** Latest raw price (EUR) for many cards at once → Map<cardId, priceEur>. */
export async function getLatestRawPrices(cardIds: string[]): Promise<Map<string, number>> {
  if (cardIds.length === 0) return new Map();
  const rows = await db.priceSnapshot.findMany({
    where: { cardId: { in: cardIds }, grade: "raw" },
    orderBy: { date: "desc" },
    select: { cardId: true, priceEur: true },
  });
  const map = new Map<string, number>();
  for (const r of rows) if (!map.has(r.cardId)) map.set(r.cardId, Number(r.priceEur));
  return map;
}

export async function getPriceHistory(cardId: string, sinceDays = 365): Promise<SnapshotPoint[]> {
  const since = new Date(Date.now() - sinceDays * 86400_000);
  const rows = await db.priceSnapshot.findMany({
    where: { cardId, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    grade: r.grade,
    priceEur: Number(r.priceEur),
  }));
}
