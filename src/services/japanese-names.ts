import { db } from "@/lib/db";
import { fetchText, sleep } from "@/lib/providers/http";
import {
  nameByNumber,
  officialCardListUrl,
  parseOfficialCardList,
  parseOfficialSeriesIds,
} from "@/domain/official-cardlist";

export interface FillNamesOptions {
  /** Fetch at most this many series pages (the site lists ~60 Japanese sets). */
  maxSeries?: number;
  /** Overwrite Japanese names that are already stored, instead of only filling gaps. */
  refill?: boolean;
  /** Restrict the work to specific cards — handy for a targeted refill, and for tests. */
  cardIds?: string[];
  /** Injectable for tests: (url) → page HTML. */
  fetchPage?: (url: string) => Promise<string>;
  /** Delay between series pages. */
  delayMs?: number;
}

export interface FillNamesResult {
  /** Series pages actually fetched successfully. */
  series: number;
  /** Card blocks parsed across those pages. */
  entries: number;
  /** Cards we wanted a name for. */
  candidates: number;
  updated: number;
  /** Cards whose number never showed up in the pages we fetched. */
  missing: number;
  errors: string[];
}

/**
 * Fill `Card.nameJp` from the official Japanese card list.
 *
 * The official site is the only source that carries the Japanese names, and its pages key cards by
 * the same number we store (`EB04-061`, `P-063`, `P-BVB-001`, …), so this walks the series pages and
 * matches on that number. Nothing is guessed: a card whose number never shows up is counted as
 * `missing` and left as it was.
 *
 * Stops early once every wanted number has been found, so a run over a mostly-filled catalog only
 * touches a few pages.
 *
 * Note on errors: the shared `fetchText` returns "" rather than throwing when a page stays
 * unavailable, so an empty response is reported as an error instead of being counted as "this card
 * simply has no name" — otherwise a blocked scrape would look like a successful, empty-handed run.
 */
export async function fillJapaneseNames(options: FillNamesOptions = {}): Promise<FillNamesResult> {
  const { maxSeries, refill = false, cardIds, fetchPage = fetchText, delayMs = 1000 } = options;

  const errors: string[] = [];
  const result: FillNamesResult = {
    series: 0,
    entries: 0,
    candidates: 0,
    updated: 0,
    missing: 0,
    errors,
  };

  const cards = await db.card.findMany({
    where: {
      ...(refill ? {} : { nameJp: null }),
      ...(cardIds ? { id: { in: cardIds } } : {}),
    },
    select: { id: true, number: true },
  });
  result.candidates = cards.length;

  const wanted = new Set(cards.map((c) => c.number).filter((n): n is string => Boolean(n)));
  if (wanted.size === 0) return result;

  const seriesIds = parseOfficialSeriesIds(await fetchPage(officialCardListUrl()));
  if (seriesIds.length === 0) {
    errors.push("cardlist index: no series ids found (page unavailable or markup changed)");
    return result;
  }
  const selected = maxSeries ? seriesIds.slice(0, maxSeries) : seriesIds;

  const found = new Map<string, string>();
  for (const [position, seriesId] of selected.entries()) {
    if (position > 0) await sleep(delayMs);
    // Isolate each set: one unavailable page must not abort the fill.
    try {
      const html = await fetchPage(officialCardListUrl(seriesId));
      if (!html) {
        errors.push(`series ${seriesId}: empty response`);
        continue;
      }

      const entries = parseOfficialCardList(html);
      result.series++;
      result.entries += entries.length;
      for (const [number, nameJp] of nameByNumber(entries)) {
        if (wanted.has(number) && !found.has(number)) found.set(number, nameJp);
      }
      if (found.size >= wanted.size) break; // nothing left to look for
    } catch (e) {
      errors.push(`series ${seriesId}: ${String(e)}`);
    }
  }

  for (const card of cards) {
    const nameJp = card.number ? found.get(card.number) : undefined;
    if (!nameJp) {
      result.missing++;
      continue;
    }
    await db.card.update({ where: { id: card.id }, data: { nameJp } });
    result.updated++;
  }

  return result;
}
