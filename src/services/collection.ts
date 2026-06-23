import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";

export function getUserCollection(userId: string) {
  return db.collectionItem.findMany({
    where: { userId },
    include: { card: true },
    orderBy: { createdAt: "desc" },
  });
}

export function upsertCollectionItem(input: {
  userId: string;
  cardId: string;
  grade: Grade;
  quantity: number;
  purchasePricePerUnit?: number | null;
}) {
  const { userId, cardId, grade, quantity, purchasePricePerUnit } = input;
  return db.collectionItem.upsert({
    where: { userId_cardId_grade: { userId, cardId, grade } },
    update: { quantity, purchasePricePerUnit: purchasePricePerUnit ?? null },
    create: { userId, cardId, grade, quantity, purchasePricePerUnit: purchasePricePerUnit ?? null },
  });
}

export function removeCollectionItem(userId: string, id: string) {
  // userId in the filter guarantees a user can only delete their own row.
  return db.collectionItem.deleteMany({ where: { id, userId } });
}
