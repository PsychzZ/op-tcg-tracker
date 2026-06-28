/**
 * Resolve a card we own to its PriceCharting product when it has no stored id yet (e.g. Western
 * promos/collabs like the BVB Luffy, which live outside the `one-piece-japanese-*` sets the bulk
 * importer covers). Pure scoring so it can be unit-tested without hitting the network.
 */

export interface ResolveCandidate {
  id: string;
  consoleName: string;
  productName: string;
}

// Non-distinctive words: every One Piece product shares them, so they add no matching signal.
const STOP = new Set(["the", "of", "and", "one", "piece", "card", "promo", "deck"]);

function tokens(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(" ")
      .filter((t) => t.length > 1 && !STOP.has(t)),
  );
}

/** "One Piece Ultra Deck: The Three Brothers" → "one-piece-ultra-deck-the-three-brothers". */
export function slugifyConsole(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Pick the PriceCharting product that best matches a card by name/number overlap.
 * Rejects non-One-Piece hits (Funko, LEGO, …) and DON!! cards. Returns null if nothing scores.
 */
export function pickBestProduct(
  card: { name: string; number: string | null },
  candidates: ResolveCandidate[],
): ResolveCandidate | null {
  const nameTokens = tokens(card.name);
  const num = card.number ? card.number.toUpperCase().replace(/\s+/g, "") : null;
  let best: ResolveCandidate | null = null;
  let bestScore = 0;

  for (const c of candidates) {
    if (!/one piece/i.test(c.consoleName)) continue; // OP cards only → drops Funko/LEGO/etc.
    if (/\bdon!?\b/i.test(c.productName)) continue;
    const pTokens = tokens(c.productName);
    let score = 0;
    for (const t of nameTokens) if (pTokens.has(t)) score += 1;
    if (num) {
      const pNum = c.productName.toUpperCase().replace(/\s+/g, "");
      if (pNum.includes(num)) score += 3;
    }
    if (/japanese/i.test(c.consoleName)) score += 0.5; // prefer JP when otherwise tied
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  return bestScore >= 1 ? best : null;
}
