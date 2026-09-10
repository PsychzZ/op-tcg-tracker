import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import {
  countUnseenAlerts,
  evaluateAlerts,
  getUserAlerts,
  markAlertsSeen,
  setWatchTarget,
} from "./alerts";

/** UTC midnight for a deterministic day offset — PriceSnapshot.date is a DATE column. */
function day(offset: number): Date {
  return new Date(`${new Date(Date.UTC(2026, 0, 10 + offset)).toISOString().slice(0, 10)}T00:00:00.000Z`);
}

async function snapshot(cardId: string, date: Date, priceEur: number) {
  return db.priceSnapshot.create({
    data: {
      cardId,
      grade: "raw",
      date,
      priceNative: priceEur,
      currency: "USD",
      priceEur,
      fxRate: 1,
      source: "priceCharting",
    },
  });
}

describe("target-price alerts (integration)", () => {
  const ids: { users: string[]; cards: string[] } = { users: [], cards: [] };

  afterAll(async () => {
    await db.priceAlert.deleteMany({ where: { userId: { in: ids.users } } });
    await db.watchlistItem.deleteMany({ where: { userId: { in: ids.users } } });
    await db.priceSnapshot.deleteMany({ where: { cardId: { in: ids.cards } } });
    await db.card.deleteMany({ where: { id: { in: ids.cards } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.$disconnect();
  });

  it("fires on the crossing down, stays quiet while cheap, re-arms after a recovery", async () => {
    const stamp = Date.now();
    const a = await db.user.create({
      data: { email: `alert_a_${stamp}@t.test`, displayName: "A", passwordHash: "x", role: "friend" },
    });
    const b = await db.user.create({
      data: { email: `alert_b_${stamp}@t.test`, displayName: "B", passwordHash: "x", role: "friend" },
    });
    ids.users.push(a.id, b.id);

    const card = await db.card.create({
      data: {
        externalId: `ALERT-${stamp}`,
        name: "Alert Test",
        rarity: "SEC",
        variant: "normal",
        category: "booster",
        language: "ja",
      },
    });
    ids.cards.push(card.id);

    // Both users watch the card; only A sets a target → B must never receive an alert.
    await db.watchlistItem.create({ data: { userId: a.id, cardId: card.id } });
    await db.watchlistItem.create({ data: { userId: b.id, cardId: card.id } });
    await setWatchTarget(a.id, card.id, "raw", 100);

    // Day 0 — above the target: arms the rule, no alert.
    await snapshot(card.id, day(0), 120);
    const day0 = await evaluateAlerts(day(0));
    expect(day0.triggered).toEqual([]);
    expect(day0.errors).toEqual([]);

    // Day 1 — crosses down to 95 ≤ 100: exactly one alert.
    await snapshot(card.id, day(1), 95);
    const day1 = await evaluateAlerts(day(1));
    expect(day1.triggered).toEqual([
      { cardId: card.id, cardName: "Alert Test", grade: "raw", targetPriceEur: 100, priceEur: 95 },
    ]);

    // Re-running the same day must not duplicate (unique user/card/grade/day).
    expect((await evaluateAlerts(day(1))).triggered).toEqual([]);

    // Day 2 — still below the target: no daily spam.
    await snapshot(card.id, day(2), 90);
    expect((await evaluateAlerts(day(2))).triggered).toEqual([]);

    // Day 3 — recovers above the target: silent, but re-arms the rule.
    await snapshot(card.id, day(3), 130);
    expect((await evaluateAlerts(day(3))).triggered).toEqual([]);

    // Day 4 — crosses down again: a second alert.
    await snapshot(card.id, day(4), 99);
    expect((await evaluateAlerts(day(4))).triggered).toHaveLength(1);

    // A sees their two alerts, B sees nothing, and unseen counting is per user.
    const aAlerts = await getUserAlerts(a.id);
    expect(aAlerts).toHaveLength(2);
    expect(aAlerts.map((x) => Number(x.priceEur)).sort((m, n) => m - n)).toEqual([95, 99]);
    expect(await countUnseenAlerts(a.id)).toBe(2);
    expect(await getUserAlerts(b.id)).toEqual([]);
    expect(await countUnseenAlerts(b.id)).toBe(0);

    // Marking seen only touches the calling user's alerts.
    await markAlertsSeen(a.id);
    expect(await countUnseenAlerts(a.id)).toBe(0);
    expect(await getUserAlerts(a.id, { unseenOnly: true })).toEqual([]);
    expect(await getUserAlerts(a.id)).toHaveLength(2);
  });

  it("reports a target that is already reached when the rule has never fired", async () => {
    const stamp = Date.now();
    const user = await db.user.create({
      data: { email: `alert_c_${stamp}@t.test`, displayName: "C", passwordHash: "x", role: "friend" },
    });
    ids.users.push(user.id);

    const card = await db.card.create({
      data: {
        externalId: `ALERT-CHEAP-${stamp}`,
        name: "Already Cheap",
        rarity: "SR",
        variant: "normal",
        category: "booster",
        language: "ja",
      },
    });
    ids.cards.push(card.id);

    // Price history exists and is already below the target before the rule is ever set.
    await snapshot(card.id, day(0), 80);
    await db.watchlistItem.create({ data: { userId: user.id, cardId: card.id } });
    await setWatchTarget(user.id, card.id, "raw", 100);

    const first = await evaluateAlerts(day(0));
    expect(first.triggered).toEqual([
      { cardId: card.id, cardName: "Already Cheap", grade: "raw", targetPriceEur: 100, priceEur: 80 },
    ]);

    // Once reported, it stays quiet while the price remains at/below the target.
    await snapshot(card.id, day(1), 85);
    expect((await evaluateAlerts(day(1))).triggered).toEqual([]);
  });
});
