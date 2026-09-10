/**
 * Parser for the official Japanese One Piece card list (onepiece-cardgame.com/cardlist).
 *
 * The page is server-rendered and lists one `<dl class="modalCol" id="EB04-061_p3">` block per
 * card, with the number (and an artwork-variant suffix) in the element id and the Japanese name in
 * `<div class="cardName">`. Variant rows repeat the same number, so everything downstream works on a
 * number → name map.
 *
 * Kept tolerant on purpose: unknown wrappers or extra attributes must not break a whole run, since
 * the markup is not ours and can change.
 */

const CARD_BLOCK_RE = /<dl[^>]*class="[^"]*modalCol[^"]*"[^>]*id="([^"]+)"[^>]*>([\s\S]*?)(?=<dl[^>]*class="[^"]*modalCol|$)/g;
const CARD_NAME_RE = /<div[^>]*class="[^"]*cardName[^"]*"[^>]*>([\s\S]*?)<\/div>/;
const INFO_COL_RE = /<div[^>]*class="[^"]*infoCol[^"]*"[^>]*>([\s\S]*?)<\/div>/;
const SPAN_RE = /<span[^>]*>([\s\S]*?)<\/span>/g;

export interface OfficialCardEntry {
  /** Card number as printed, e.g. "EB04-061" (the artwork suffix from the element id is stripped). */
  number: string;
  /** Japanese name, e.g. "モンキー・Ｄ・ルフィ". */
  nameJp: string;
  /** Artwork marker from the element id ("p3" in `EB04-061_p3`), null when the id has none. */
  artwork: string | null;
  /** Display rarity from the info column, e.g. "SEC" — informational, ours may differ. */
  rarity: string | null;
}

/** Strip tags, decode the few entities the site emits, collapse whitespace. */
function text(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** "EB04-061_p3" → { number: "EB04-061", artwork: "p3" } */
export function splitCardId(id: string): { number: string; artwork: string | null } | null {
  const match = id.trim().match(/^([A-Za-z]+-?\d{1,4}(?:-[A-Za-z0-9]+)*?)(?:_([A-Za-z0-9]+))?$/);
  if (!match) return null;
  return { number: match[1].toUpperCase(), artwork: match[2] ?? null };
}

/** Every series id the page offers, in page order (there are ~60 Japanese sets). */
export function parseOfficialSeriesIds(html: string): string[] {
  const ids = new Set<string>();
  for (const match of html.matchAll(/<option[^>]*value="(\d+)"[^>]*>/g)) ids.add(match[1]);
  return [...ids];
}

/** The card list URL for one series (no argument = the site's own default series). */
export function officialCardListUrl(seriesId?: string): string {
  const base = "https://www.onepiece-cardgame.com/cardlist/";
  return seriesId ? `${base}?series=${encodeURIComponent(seriesId)}` : base;
}

/** All cards on one series page. Entries without a number or name are dropped. */
export function parseOfficialCardList(html: string): OfficialCardEntry[] {
  const entries: OfficialCardEntry[] = [];

  for (const match of html.matchAll(CARD_BLOCK_RE)) {
    const split = splitCardId(match[1]);
    if (!split) continue;

    const block = match[2];
    const nameMatch = block.match(CARD_NAME_RE);
    const nameJp = nameMatch ? text(nameMatch[1]) : "";
    if (!nameJp) continue;

    let rarity: string | null = null;
    const infoMatch = block.match(INFO_COL_RE);
    if (infoMatch) {
      const spans = [...infoMatch[1].matchAll(SPAN_RE)].map((s) => text(s[1])).filter(Boolean);
      // The info column reads "number | rarity | type"; the number is ours already.
      rarity = spans[1] ?? null;
    }

    entries.push({ number: split.number, nameJp, artwork: split.artwork, rarity });
  }

  return entries;
}

/** Collapse parsed entries into the number → name map the filler works with (first entry wins). */
export function nameByNumber(entries: OfficialCardEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (!map.has(entry.number)) map.set(entry.number, entry.nameJp);
  }
  return map;
}
