import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";
import { portfolioTotals, type OwnedItem } from "@/domain/valuation";
import { getLatestPriceMap } from "@/services/prices";
import { pctChange } from "@/domain/movers";

export async function getDashboard(userId: string) {
  const items = await db.collectionItem.findMany({ where: { userId }, include: { card: true } });

  const cardIds = [...new Set(items.map((i) => i.cardId))];
  const priceMaps = new Map<string, Record<Grade, number>>();
  await Promise.all(cardIds.map(async (id) => priceMaps.set(id, await getLatestPriceMap(id))));

  const totals: Record<Grade, number> = { raw: 0, psa9: 0, psa10: 0 };
  for (const item of items) {
    const price = priceMaps.get(item.cardId)?.[item.grade] ?? 0;
    const owned: OwnedItem = { grade: item.grade, quantity: item.quantity, purchasePricePerUnit: null };
    const sub = portfolioTotals([owned], { raw: price, psa9: price, psa10: price });
    totals[item.grade] += sub[item.grade];
  }

  const since = new Date(Date.now() - 30 * 86400_000);
  const movers: Array<{ name: string; cardId: string; pct: number }> = [];
  for (const id of cardIds) {
    const recent = await db.priceSnapshot.findFirst({ where: { cardId: id, grade: "psa10" }, orderBy: { date: "desc" } });
    const old = await db.priceSnapshot.findFirst({ where: { cardId: id, grade: "psa10", date: { lte: since } }, orderBy: { date: "desc" } });
    if (recent && old) {
      const pct = pctChange(Number(old.priceEur), Number(recent.priceEur));
      if (pct != null) {
        const card = items.find((i) => i.cardId === id)?.card;
        if (card) movers.push({ name: card.name, cardId: id, pct });
      }
    }
  }
  movers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  const distribution: Record<string, number> = {};
  for (const item of items) {
    distribution[item.card.rarity] = (distribution[item.card.rarity] ?? 0) + item.quantity;
  }

  return { totals, movers: movers.slice(0, 5), distribution, count: items.length };
}
