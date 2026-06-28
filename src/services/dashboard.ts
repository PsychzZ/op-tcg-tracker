import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";
import { portfolioTotals, type OwnedItem } from "@/domain/valuation";
import { getLatestPriceMap } from "@/services/prices";
import { pctChange } from "@/domain/movers";

export interface PortfolioPoint {
  date: string;
  value: number;
}

/**
 * Portfolio value over time: for each owned position, carry its last-known grade price forward and
 * sum across holdings on every snapshot date. Cheap — a single collection has a handful of items.
 */
async function portfolioHistory(
  items: Array<{ cardId: string; grade: Grade; quantity: number }>,
  days: number,
): Promise<PortfolioPoint[]> {
  if (items.length === 0) return [];
  const since = new Date(Date.now() - days * 86400_000);
  const cardIds = [...new Set(items.map((i) => i.cardId))];
  const snaps = await db.priceSnapshot.findMany({
    where: { cardId: { in: cardIds }, date: { gte: since } },
    orderBy: { date: "asc" },
    select: { cardId: true, grade: true, date: true, priceEur: true },
  });
  if (snaps.length === 0) return [];

  const series = new Map<string, Array<{ t: number; p: number }>>();
  for (const s of snaps) {
    const k = `${s.cardId}|${s.grade}`;
    const arr = series.get(k) ?? [];
    arr.push({ t: s.date.getTime(), p: Number(s.priceEur) });
    series.set(k, arr);
  }

  const dates = [...new Set(snaps.map((s) => s.date.toISOString().slice(0, 10)))].sort();
  return dates.map((d) => {
    const t = new Date(d).getTime();
    let value = 0;
    for (const item of items) {
      const arr = series.get(`${item.cardId}|${item.grade}`);
      if (!arr) continue;
      let price = 0;
      for (const e of arr) {
        if (e.t <= t) price = e.p;
        else break;
      }
      value += price * item.quantity;
    }
    return { date: d, value };
  });
}

export async function getDashboard(userId: string, rangeDays = 90) {
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

  // Portfolio trend (90d series for the sparkline) + 30d change.
  const history = await portfolioHistory(items, rangeDays);
  let change30 = { pct: null as number | null, eur: 0 };
  if (history.length >= 2) {
    const latest = history[history.length - 1].value;
    const cutoff = Date.now() - 30 * 86400_000;
    const ref = [...history].reverse().find((p) => new Date(p.date).getTime() <= cutoff) ?? history[0];
    change30 = { pct: pctChange(ref.value, latest), eur: latest - ref.value };
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

  const holdings = items
    .map((item) => {
      const price = priceMaps.get(item.cardId)?.[item.grade] ?? 0;
      return {
        id: item.id,
        card: item.card,
        grade: item.grade,
        quantity: item.quantity,
        valueEur: price * item.quantity,
      };
    })
    .sort((a, b) => b.valueEur - a.valueEur);

  return {
    totals,
    movers: movers.slice(0, 5),
    distribution,
    count: items.length,
    holdings,
    history,
    change30,
  };
}
