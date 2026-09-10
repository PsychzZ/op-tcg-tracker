import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getRealizedTotals, getUserSales, recordSale, SaleError } from "./sales";

describe("sale tracking (integration)", () => {
  const ids: { users: string[]; cards: string[] } = { users: [], cards: [] };

  afterAll(async () => {
    await db.sale.deleteMany({ where: { userId: { in: ids.users } } });
    await db.collectionItem.deleteMany({ where: { userId: { in: ids.users } } });
    await db.card.deleteMany({ where: { id: { in: ids.cards } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.$disconnect();
  });

  async function makeUser(tag: string) {
    const user = await db.user.create({
      data: {
        email: `sale_${tag}_${Date.now()}@t.test`,
        displayName: tag.toUpperCase(),
        passwordHash: "x",
        role: "friend",
      },
    });
    ids.users.push(user.id);
    return user;
  }

  async function makeCard(tag: string) {
    const card = await db.card.create({
      data: {
        externalId: `SALE-${tag}-${Date.now()}`,
        name: `Sale Test ${tag}`,
        rarity: "SEC",
        variant: "normal",
        category: "booster",
        language: "ja",
      },
    });
    ids.cards.push(card.id);
    return card;
  }

  it("records a sale, reduces the holding, keeps the cost basis and reports the P/L", async () => {
    const user = await makeUser("a");
    const card = await makeCard("a");
    await db.collectionItem.create({
      data: {
        userId: user.id,
        cardId: card.id,
        grade: "psa10",
        quantity: 3,
        purchasePricePerUnit: 200,
      },
    });

    await recordSale({
      userId: user.id,
      cardId: card.id,
      grade: "psa10",
      quantity: 1,
      soldPricePerUnit: 350,
      soldAt: new Date("2026-02-01T00:00:00.000Z"),
      feesEur: 20,
    });

    const item = await db.collectionItem.findUnique({
      where: { userId_cardId_grade: { userId: user.id, cardId: card.id, grade: "psa10" } },
    });
    expect(item?.quantity).toBe(2);

    const sales = await getUserSales(user.id);
    expect(sales).toHaveLength(1);
    expect(Number(sales[0].costBasisPerUnit)).toBe(200);
    expect(Number(sales[0].soldPricePerUnit)).toBe(350);
    expect(sales[0].grade).toBe("psa10");

    const totals = await getRealizedTotals(user.id);
    expect(totals.count).toBe(1);
    expect(totals.units).toBe(1);
    expect(totals.proceeds).toBe(350);
    expect(totals.fees).toBe(20);
    expect(totals.cost).toBe(200);
    expect(totals.pnlEur).toBe(130); // 350 − 20 − 200
    expect(totals.pnlPct).toBe(65);
    expect(totals.unknownCostCount).toBe(0);
  });

  it("removes the holding once the last copy is sold", async () => {
    const user = await makeUser("b");
    const card = await makeCard("b");
    await db.collectionItem.create({
      data: { userId: user.id, cardId: card.id, grade: "raw", quantity: 1, purchasePricePerUnit: 10 },
    });

    await recordSale({
      userId: user.id,
      cardId: card.id,
      grade: "raw",
      quantity: 1,
      soldPricePerUnit: 25,
      soldAt: new Date("2026-02-02T00:00:00.000Z"),
    });

    const item = await db.collectionItem.findUnique({
      where: { userId_cardId_grade: { userId: user.id, cardId: card.id, grade: "raw" } },
    });
    expect(item).toBeNull();
    expect(await getUserSales(user.id)).toHaveLength(1);
  });

  it("counts a sale without a purchase price as unknown cost instead of inventing profit", async () => {
    const user = await makeUser("c");
    const card = await makeCard("c");
    await db.collectionItem.create({
      data: { userId: user.id, cardId: card.id, grade: "raw", quantity: 1 },
    });

    await recordSale({
      userId: user.id,
      cardId: card.id,
      grade: "raw",
      quantity: 1,
      soldPricePerUnit: 90,
      soldAt: new Date("2026-02-03T00:00:00.000Z"),
    });

    const totals = await getRealizedTotals(user.id);
    expect(totals.proceeds).toBe(90);
    expect(totals.pnlEur).toBe(0);
    expect(totals.pnlPct).toBeNull();
    expect(totals.unknownCostCount).toBe(1);
  });

  it("refuses to sell more than the user owns or another user's holding", async () => {
    const owner = await makeUser("d");
    const stranger = await makeUser("e");
    const card = await makeCard("d");
    await db.collectionItem.create({
      data: { userId: owner.id, cardId: card.id, grade: "psa9", quantity: 1, purchasePricePerUnit: 100 },
    });

    const base = {
      cardId: card.id,
      grade: "psa9" as const,
      soldPricePerUnit: 150,
      soldAt: new Date("2026-02-04T00:00:00.000Z"),
    };

    await expect(recordSale({ ...base, userId: owner.id, quantity: 5 })).rejects.toBeInstanceOf(SaleError);
    await expect(recordSale({ ...base, userId: stranger.id, quantity: 1 })).rejects.toBeInstanceOf(SaleError);
    await expect(recordSale({ ...base, userId: owner.id, quantity: 0 })).rejects.toBeInstanceOf(SaleError);

    // Nothing was written and the holding is untouched.
    expect(await getUserSales(owner.id)).toEqual([]);
    expect(await getUserSales(stranger.id)).toEqual([]);
    const item = await db.collectionItem.findUnique({
      where: { userId_cardId_grade: { userId: owner.id, cardId: card.id, grade: "psa9" } },
    });
    expect(item?.quantity).toBe(1);
  });
});
