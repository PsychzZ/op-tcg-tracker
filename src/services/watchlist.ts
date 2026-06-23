import { db } from "@/lib/db";

export function getUserWatchlist(userId: string) {
  return db.watchlistItem.findMany({ where: { userId }, include: { card: true } });
}

export async function toggleWatch(userId: string, cardId: string) {
  const existing = await db.watchlistItem.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });
  if (existing) {
    await db.watchlistItem.delete({ where: { id: existing.id } });
    return false;
  }
  await db.watchlistItem.create({ data: { userId, cardId } });
  return true;
}
