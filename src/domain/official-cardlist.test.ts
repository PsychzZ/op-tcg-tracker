import { describe, it, expect } from "vitest";
import {
  nameByNumber,
  officialCardListUrl,
  parseOfficialCardList,
  parseOfficialSeriesIds,
  splitCardId,
} from "./official-cardlist";

/**
 * Fixture in the shape of the live page (structure mirrored, contents shortened). The real page
 * lists ~169 of these blocks per series; keeping a tiny one makes the expectations readable.
 */
const PAGE = `
<html><body>
<select name="series">
  <option value="550117">最新弾</option>
  <option value="550302">第2弾</option>
  <option value="550117">重複は無視</option>
</select>
<dl class="modalCol" id="EB04-061_p3">
  <dt>
    <button class="scrollBtn">ボタン</button>
    <div class="infoCol"><span>EB04-061</span> | <span>SEC</span> | <span>CHARACTER</span></div>
    <div class="cardName">モンキー・Ｄ・ルフィ</div>
  </dt>
  <dd><div class="frontCol"><img class="lazy" src="dummy.gif" alt="モンキー・Ｄ・ルフィ"></div></dd>
</dl>
<dl class="modalCol" id="EB04-061_p1">
  <dt>
    <div class="infoCol"><span>EB04-061</span> | <span>SEC</span> | <span>CHARACTER</span></div>
    <div class="cardName">モンキー・Ｄ・ルフィ</div>
  </dt>
</dl>
<dl class="modalCol" id="OP13-051">
  <dt>
    <div class="infoCol"><span>OP13-051</span> | <span>SR</span> | <span>CHARACTER</span></div>
    <div class="cardName">ボア・ハンコック</div>
  </dt>
</dl>
<dl class="modalCol" id="broken-id">
  <dt><div class="cardName">番号なし</div></dt>
</dl>
<dl class="modalCol" id="P-063_p1">
  <dt>
    <div class="infoCol"><span>P-063</span> | <span>P</span> | <span>CHARACTER</span></div>
    <div class="cardName">ジンベエ</div>
  </dt>
</dl>
</body></html>
`;

describe("splitCardId", () => {
  it("separates the number from the artwork suffix", () => {
    expect(splitCardId("EB04-061_p3")).toEqual({ number: "EB04-061", artwork: "p3" });
    expect(splitCardId("OP13-051")).toEqual({ number: "OP13-051", artwork: null });
    expect(splitCardId("P-063_p1")).toEqual({ number: "P-063", artwork: "p1" });
    expect(splitCardId("st18-005")).toEqual({ number: "ST18-005", artwork: null });
  });

  it("rejects ids that are not card numbers", () => {
    expect(splitCardId("broken-id")).toBeNull();
    expect(splitCardId("")).toBeNull();
  });
});

describe("parseOfficialSeriesIds", () => {
  it("lists each series id once, in page order", () => {
    expect(parseOfficialSeriesIds(PAGE)).toEqual(["550117", "550302"]);
  });
});

describe("officialCardListUrl", () => {
  it("builds the base and per-series URLs", () => {
    expect(officialCardListUrl()).toBe("https://www.onepiece-cardgame.com/cardlist/");
    expect(officialCardListUrl("550117")).toBe(
      "https://www.onepiece-cardgame.com/cardlist/?series=550117",
    );
  });
});

describe("parseOfficialCardList", () => {
  it("reads the number, Japanese name, artwork marker and rarity of each card", () => {
    expect(parseOfficialCardList(PAGE)).toEqual([
      { number: "EB04-061", nameJp: "モンキー・Ｄ・ルフィ", artwork: "p3", rarity: "SEC" },
      { number: "EB04-061", nameJp: "モンキー・Ｄ・ルフィ", artwork: "p1", rarity: "SEC" },
      { number: "OP13-051", nameJp: "ボア・ハンコック", artwork: null, rarity: "SR" },
      { number: "P-063", nameJp: "ジンベエ", artwork: "p1", rarity: "P" },
    ]);
  });

  it("skips blocks without a usable number or name", () => {
    const numbers = parseOfficialCardList(PAGE).map((e) => e.number);
    expect(numbers).not.toContain("BROKEN-ID");
    expect(parseOfficialCardList("<html><body>no cards here</body></html>")).toEqual([]);
  });

  it("decodes the entities the site emits", () => {
    const html = `<dl class="modalCol" id="OP01-001"><div class="cardName">A &amp; B &lt;C&gt;</div></dl>`;
    expect(parseOfficialCardList(html)[0].nameJp).toBe("A & B <C>");
  });
});

describe("nameByNumber", () => {
  it("keeps the first name per number (variant rows share one name)", () => {
    const map = nameByNumber(parseOfficialCardList(PAGE));
    expect(map.size).toBe(3);
    expect(map.get("EB04-061")).toBe("モンキー・Ｄ・ルフィ");
    expect(map.get("OP13-051")).toBe("ボア・ハンコック");
    expect(map.get("P-063")).toBe("ジンベエ");
  });
});
