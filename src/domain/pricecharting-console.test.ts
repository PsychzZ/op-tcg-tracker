import { describe, it, expect } from "vitest";
import { parseConsoleSlugs, parseConsoleRows, consoleSlugToName } from "./pricecharting-console";

describe("parseConsoleSlugs", () => {
  it("extracts distinct Japanese slugs, including URL-encoded chars (apostrophe)", () => {
    const html = `
      <a href="/console/one-piece-japanese-romance-dawn">x</a>
      <a href="/console/one-piece-japanese-romance-dawn">dup</a>
      <a href="/console/one-piece-japanese-azure-sea%27s-seven">apostrophe set</a>
      <a href="/console/one-piece-romance-dawn">english (ignored)</a>`;
    expect(parseConsoleSlugs(html)).toEqual([
      "one-piece-japanese-romance-dawn",
      "one-piece-japanese-azure-sea%27s-seven",
    ]);
  });
});

describe("parseConsoleRows", () => {
  const html = `
    <tr id="product-111"><td class="title"><a href="/game/x/luffy-op01-001">Luffy [Alternate Art] OP01-001</a></td>
      <td class="price numeric used_price"><span class="js-price">$50.75</span></td>
      <td class="price numeric cib_price"><span class="js-price">$48.99</span></td>
      <td class="price numeric new_price"><span class="js-price">$222.50</span></td></tr>
    <tr id="product-222"><td class="title"><a href="/game/x/nami-op01-016">Nami OP01-016</a></td>
      <td class="price numeric used_price"><span class="js-price">$1,234.00</span></td>
      <td class="price numeric cib_price"><span class="js-price">-</span></td>
      <td class="price numeric new_price"><span class="js-price">-</span></td></tr>`;

  it("parses id, name, and the three grade columns (raw / PSA9 / PSA10) in cents", () => {
    expect(parseConsoleRows(html)).toEqual([
      { id: "111", name: "Luffy [Alternate Art] OP01-001", loosePriceCents: 5075, psa9PriceCents: 4899, psa10PriceCents: 22250 },
      { id: "222", name: "Nami OP01-016", loosePriceCents: 123400, psa9PriceCents: 0, psa10PriceCents: 0 },
    ]);
  });
});

describe("consoleSlugToName", () => {
  it("decodes and de-hyphenates a slug into a JP-matching name", () => {
    expect(consoleSlugToName("one-piece-japanese-azure-sea%27s-seven")).toBe("one piece japanese azure sea's seven");
  });
});
