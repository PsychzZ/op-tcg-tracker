import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { classifyPcCard } from "@/domain/pricecharting-catalog";
import { upsertCatalogCard } from "./catalog-refresh";

const PC_IMAGE = "https://commondatastorage.googleapis.com/images.pricecharting.com/abc123/1600.jpg";

describe("catalog refresh persistence (integration)", () => {
  const ids: { cards: string[] } = { cards: [] };

  afterAll(async () => {
    await db.card.deleteMany({ where: { id: { in: ids.cards } } });
    await db.$disconnect();
  });

  function classified(id: string, productName: string) {
    const card = classifyPcCard({
      id,
      "console-name": "One Piece Japanese Carrying on His Will",
      "product-name": productName,
    });
    if (!card) throw new Error(`fixture did not classify: ${productName}`);
    return { ...card, externalId: `pc-itest-${id}` };
  }

  it("stores number, set/category, variant and the per-variant image", async () => {
    const card = classified("itest-1", "Monkey D. Luffy (Alternate Art) OP01-003");

    const outcome = await upsertCatalogCard(card, PC_IMAGE);
    expect(outcome).toBe("created");

    const row = await db.card.findUnique({ where: { externalId: card.externalId } });
    if (!row) throw new Error("row missing");
    ids.cards.push(row.id);

    expect(row.number).toBe("OP01-003");
    expect(row.setCode).toBe("OP01");
    expect(row.category).toBe("booster");
    expect(row.variant).toBe("altArt");
    expect(row.rarity).toBe("SR");
    expect(row.language).toBe("ja");
    expect(row.imageUrl).toBe(PC_IMAGE);
    expect(row.providerIds).toMatchObject({ priceCharting: "itest-1" });
  });

  it("updates an existing row without wiping a stored image", async () => {
    const card = classified("itest-2", "Nami [Parallel] OP01-016");

    await upsertCatalogCard(card, PC_IMAGE);
    const first = await db.card.findUnique({ where: { externalId: card.externalId } });
    if (!first) throw new Error("row missing");
    ids.cards.push(first.id);

    // A later refresh that could not fetch an image must keep the one that is already stored.
    const outcome = await upsertCatalogCard(card, null);
    expect(outcome).toBe("updated");

    const second = await db.card.findUnique({ where: { externalId: card.externalId } });
    expect(second?.id).toBe(first.id);
    expect(second?.imageUrl).toBe(PC_IMAGE);
    expect(second?.variant).toBe("parallel");
  });

  it("re-derives set and category from the number rather than the console it was scraped from", async () => {
    // Same product scraped from the Promo console: the number (OP12-039) wins, so it stays in OP12.
    const card = classifyPcCard({
      id: "itest-3",
      "console-name": "One Piece Japanese Promo",
      "product-name": "Luffy Is The Man [3rd Anniversary] OP12-039",
    });
    if (!card) throw new Error("fixture did not classify");

    await upsertCatalogCard({ ...card, externalId: "pc-itest-3" }, null);
    const row = await db.card.findUnique({ where: { externalId: "pc-itest-3" } });
    if (!row) throw new Error("row missing");
    ids.cards.push(row.id);

    expect(row.setCode).toBe("OP12");
    expect(row.category).toBe("booster");
  });
});
