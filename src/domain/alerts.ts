import { round2 } from "./money";

/**
 * Whether a target-price alert should fire right now.
 *
 * A rule is *armed* while the price sits above the target and fires on the crossing down to (or
 * below) it — so a card that stays cheap does not re-alert on every daily run.
 *
 * `previousPriceEur === null` means "nothing to compare against": either the rule has no earlier
 * price at all, or it has never fired yet (see `evaluateAlerts`, which passes null for a rule that
 * has no recorded alert). Both cases should report an already-reached target once, instead of
 * staying silent until the price recovers and crosses back.
 */
export function isAlertTriggered(
  previousPriceEur: number | null,
  currentPriceEur: number,
  targetPriceEur: number,
): boolean {
  if (!(targetPriceEur > 0)) return false;
  if (!(currentPriceEur > 0)) return false;
  if (currentPriceEur > targetPriceEur) return false;
  if (previousPriceEur === null) return true;
  return previousPriceEur > targetPriceEur;
}

/**
 * How far the current price still is above the target, in percent. Negative means the price is
 * already below the target. Returns null when there is nothing meaningful to compare.
 */
export function distanceToTargetPct(
  currentPriceEur: number | null,
  targetPriceEur: number | null,
): number | null {
  if (currentPriceEur == null || targetPriceEur == null) return null;
  if (!(currentPriceEur > 0) || !(targetPriceEur > 0)) return null;
  return round2(((currentPriceEur - targetPriceEur) / targetPriceEur) * 100);
}

/** True once the latest known price has reached the target. */
export function isTargetReached(currentPriceEur: number | null, targetPriceEur: number | null): boolean {
  if (currentPriceEur == null || targetPriceEur == null) return false;
  if (!(currentPriceEur > 0) || !(targetPriceEur > 0)) return false;
  return currentPriceEur <= targetPriceEur;
}
