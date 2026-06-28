import type { Category } from "@prisma/client";

/**
 * Canonical set/category derivation from a card's number. The number is the source of truth — a card
 * belongs to the set its number names (OP07-051 → OP07), regardless of which PriceCharting console
 * page it was scraped from. This keeps special "promo" variants (e.g. championship/For-Asia versions
 * of an OP07 card) inside their numbered set instead of scattering them into a Promo bucket.
 */

// OP07-051, ST13-003, EB01-001, PRB01-001 — 2-4 letters, a set number, a card number.
const SET_RE = /\b([A-Z]{2,4}\d{2}-\d{2,3})\b/i;
// P-063, P-BVB-001, P-001 — the One Piece promotional numbering.
const PROMO_RE = /\bP-(?:[A-Z]{1,4}-)?\d{2,3}\b/i;

/** Find a real card number in the number field or, failing that, embedded in the name. */
export function parseCardNumber(name: string, rawNumber: string | null): string | null {
  const hay = `${rawNumber ?? ""} ${name}`;
  const set = hay.match(SET_RE);
  if (set) return set[1].toUpperCase();
  const promo = hay.match(PROMO_RE);
  if (promo) return promo[0].toUpperCase();
  return null;
}

export interface DerivedCard {
  number: string;
  setCode: string | null;
  category: Category;
}

/**
 * Derive {number, setCode, category} for a single, or null when no card number can be found
 * (sealed products like "Booster Box", or junk rows) — callers treat null as "not a trackable card".
 * Collab/special cards keep their identity (no numbered set bucket).
 */
export function deriveCard(
  name: string,
  rawNumber: string | null,
  existingCategory: Category,
): DerivedCard | null {
  const number = parseCardNumber(name, rawNumber);
  if (!number) return null;
  if (existingCategory === "specialCollab") return { number, setCode: null, category: "specialCollab" };

  const prefix = number.split("-")[0]; // OP07, ST13, EB01, PRB01, P
  if (prefix === "P") return { number, setCode: null, category: "promo" };
  if (prefix.startsWith("ST")) return { number, setCode: prefix, category: "starter" };
  return { number, setCode: prefix, category: "booster" }; // OP / EB / PRB
}

/** Which browse section a set belongs to — derived from the set code so grouping is deterministic. */
export function sectionFor(setCode: string | null, category: Category): Category {
  if (!setCode) return category; // promo / specialCollab buckets keep their category
  if (/^ST/i.test(setCode)) return "starter";
  return "booster";
}
