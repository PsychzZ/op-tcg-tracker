import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getUserCollection, upsertCollectionItem } from "./collection";

describe("collection data isolation (integration)", () => {
  const ids: { users: string[]; cards: string[] } = { users: [], cards: [] };

  afterAll(async () => {
    await db.collectionItem.deleteMany({ where: { userId: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.card.deleteMany({ where: { id: { in: ids.cards } } });
    await db.$disconnect();
  });

  it("a user never sees another user's collection items", async () => {
    const a = await db.user.create({ data: { email: `a_${Date.now()}@t.test`, displayName: "A", passwordHash: "x", role: "friend" } });
    const b = await db.user.create({ data: { email: `b_${Date.now()}@t.test`, displayName: "B", passwordHash: "x", role: "friend" } });
    ids.users.push(a.id, b.id);
    const card = await db.card.create({ data: { externalId: `T-${Date.now()}`, name: "Test", rarity: "SEC", variant: "normal", category: "booster", language: "ja" } });
    ids.cards.push(card.id);

    await upsertCollectionItem({ userId: a.id, cardId: card.id, grade: "psa10", quantity: 1 });

    const aColl = await getUserCollection(a.id);
    const bColl = await getUserCollection(b.id);
    expect(aColl).toHaveLength(1);
    expect(bColl).toHaveLength(0);
  });
});
