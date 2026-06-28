/** A card row scraped from a PriceCharting console (set) page. Prices are USD cents (0 if none). */
export interface ConsoleRow {
  id: string;
  name: string;
  loosePriceCents: number; // "Ungraded" column (used_price) → raw
  psa9PriceCents: number; // "Grade 9" column (cib_price) → PSA 9
  psa10PriceCents: number; // "PSA 10" column (new_price) → PSA 10
}

/** Extract distinct Japanese One Piece console (set) slugs from the category page. */
export function parseConsoleSlugs(html: string): string[] {
  const set = new Set<string>();
  // Slugs can contain URL-encoded chars (e.g. apostrophe %27 in "azure-sea%27s-seven").
  for (const m of html.matchAll(/\/console\/(one-piece-japanese-[a-z0-9%-]+)/gi)) {
    set.add(m[1].toLowerCase());
  }
  return [...set];
}

/** Slug → a console name that satisfies the Japanese-One-Piece check (e.g. for classification). */
export function consoleSlugToName(slug: string): string {
  return decodeURIComponent(slug).replace(/-/g, " ");
}

function cellCents(row: string, cls: string): number {
  const m = row.match(new RegExp(cls + "[^>]*>([\\s\\S]*?)</td>", "i"));
  const p = m?.[1].match(/\$([0-9.,]+)/)?.[1];
  return p ? Math.round(parseFloat(p.replace(/,/g, "")) * 100) : 0;
}

/**
 * Parse the product rows of a console page. Columns are Ungraded | Grade 9 | PSA 10, served as the
 * used_price / cib_price / new_price cells respectively (verified against the API loose-price).
 */
export function parseConsoleRows(html: string): ConsoleRow[] {
  const out: ConsoleRow[] = [];
  for (const chunk of html.split(/<tr[^>]*\sid="product-/i).slice(1)) {
    const id = chunk.match(/^(\d+)/)?.[1];
    if (!id) continue;
    const end = chunk.indexOf("</tr>");
    const row = end >= 0 ? chunk.slice(0, end) : chunk;
    const name = row.match(/<a[^>]*href="\/game\/[^"]+"[^>]*>([^<]+)<\/a>/i)?.[1]?.trim();
    if (!name) continue;
    out.push({
      id,
      name,
      loosePriceCents: cellCents(row, "used_price"),
      psa9PriceCents: cellCents(row, "cib_price"),
      psa10PriceCents: cellCents(row, "new_price"),
    });
  }
  return out;
}
