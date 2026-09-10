import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { fillJapaneseNames } from "./japanese-names";

/** Two series pages in the shape of the official site, with a couple of the numbers we look for. */
const INDEX = `<select><option value="550117">a</option><option value="550302">b</option></select>`;

const SERIES_A = `
<dl class="modalCol" id="OP13-051">
  <dt>
    <div class="infoCol"><span>OP13-051</span> | <span>SR</span> | <span>CHARACTER</span></div>
    <div class="cardName">ボア・ハンコック</div>
  </dt>
</dl>
<dl class="modalCol" id="OP13-118_p2">
  <dt>
    <div class="infoCol"><span>OP13-118</span> | <span>SEC</span> | <span>CHARACTER</span></div>
    <div class="cardName">モンキー・Ｄ・ルフィ</div>
  </dt>
</dl>`;

const SERIES_B = `
<dl class="modalCol" id="P-063">
  <dt>
    <div class="infoCol"><span>P-063</span> | <span>P</span> | <span>CHARACTER</span></div>
    <div class="cardName">ジンベエ</div>
  </dt>
</dl>`;

describe("japanese name fill (integration)", () => {
  const ids: { cards: string[] } = { cards: [] };

  afterAll(async () => {
    await db.card.deleteMany({ where: { id: { in: ids.cards } } });
    await db.$disconnect();
  });

  async function makeCard(number: string, tag: string) {
    const card = await db.card.create({
      data: {
        externalId: `jpname-${tag}-${Date.now()}`,
        name: `Placeholder ${tag}`,
        number,
        rarity: "SR",
        variant: "normal",
        category: "booster",
        language: "ja",
      },
    });
    ids.cards.push(card.id);
    return card;
  }

  /** The filler only ever asks official URLs; the stub answers in series order. */
  function stubFetch() {
    const calls: string[] = [];
    const fetchPage = async (url: string) => {
      calls.push(url);
      if (!url.includes("series=")) return INDEX;
      return url.endsWith("550117") ? SERIES_A : SERIES_B;
    };
    return { fetchPage, calls };
  }

  it("writes the Japanese name for a card found by its number", async () => {
    const card = await makeCard("OP13-051", "a");
    const { fetchPage } = stubFetch();

    const result = await fillJapaneseNames({ cardIds: [card.id], fetchPage, delayMs: 0 });

    expect(result.candidates).toBe(1);
    expect(result.updated).toBe(1);
    expect(result.missing).toBe(0);
    expect(result.errors).toEqual([]);

    const stored = await db.card.findUnique({ where: { id: card.id } });
    expect(stored?.nameJp).toBe("ボア・ハンコック");
  });

  it("matches variant rows by the shared number and leaves the plain name intact", async () => {
    const card = await makeCard("OP13-118", "b");
    const { fetchPage, calls } = stubFetch();

    await fillJapaneseNames({ cardIds: [card.id], fetchPage, delayMs: 0 });

    const stored = await db.card.findUnique({ where: { id: card.id } });
    // The site lists OP13-118 twice (artwork _p1/_p2); the shared number wins and the base name is
    // stored — our own `variant` column already describes the artwork.
    expect(stored?.nameJp).toBe("モンキー・Ｄ・ルフィ");
    expect(calls.filter((u) => u.includes("series=")).length).toBeGreaterThan(0);
  });

  it("counts a card as missing when no page carries its number, without touching it", async () => {
    const card = await makeCard("OP99-999", "c");
    const { fetchPage } = stubFetch();

    const result = await fillJapaneseNames({ cardIds: [card.id], fetchPage, delayMs: 0 });

    expect(result.updated).toBe(0);
    expect(result.missing).toBe(1);
    const stored = await db.card.findUnique({ where: { id: card.id } });
    expect(stored?.nameJp).toBeNull();
  });

  it("stops early once every wanted number is found", async () => {
    const card = await makeCard("P-063", "d");
    const { fetchPage, calls } = stubFetch();

    const result = await fillJapaneseNames({ cardIds: [card.id], fetchPage, delayMs: 0 });

    // P-063 lives on the second series page, so exactly two pages are fetched and no third.
    expect(calls.filter((u) => u.includes("series="))).toHaveLength(2);
    expect(result.updated).toBe(1);
  });
});
