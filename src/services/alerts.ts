import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";
import { isAlertTriggered } from "@/domain/alerts";
import { formatEur } from "@/domain/money";

const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };

export interface TriggeredAlert {
  cardId: string;
  cardName: string;
  grade: Grade;
  targetPriceEur: number;
  priceEur: number;
}

/** Fired alerts of one user, newest first. */
export function getUserAlerts(userId: string, opts: { unseenOnly?: boolean; take?: number } = {}) {
  return db.priceAlert.findMany({
    where: { userId, ...(opts.unseenOnly ? { seenAt: null } : {}) },
    orderBy: { triggeredAt: "desc" },
    take: opts.take ?? 20,
    include: { card: { select: { id: true, name: true, setCode: true, number: true } } },
  });
}

export function countUnseenAlerts(userId: string) {
  return db.priceAlert.count({ where: { userId, seenAt: null } });
}

/** Marks every unseen alert of *this* user as seen (the userId filter is the authorization). */
export function markAlertsSeen(userId: string) {
  return db.priceAlert.updateMany({ where: { userId, seenAt: null }, data: { seenAt: new Date() } });
}

/**
 * Set (or clear, with `null`) the target price of a card the user already watches. Scoped by
 * `userId`, so a forged cardId can never touch somebody else's watchlist — an unwatched card
 * simply matches no row.
 */
export function setWatchTarget(
  userId: string,
  cardId: string,
  grade: Grade,
  targetPriceEur: number | null,
) {
  return db.watchlistItem.updateMany({
    where: { userId, cardId },
    data: { grade, targetPrice: targetPriceEur },
  });
}

/**
 * Evaluate every target-price rule against the prices of `date` and record what fires.
 *
 * Called at the end of the price sync. Two things can fire:
 *   1. a crossing — armed above the target, price drops to/below it (the normal case);
 *   2. a rule that has never fired and is already at/below its target — so setting a target on a
 *      card that is cheap *today* reports immediately instead of waiting for a recovery.
 * Everything else stays quiet, and the unique (user, card, grade, day) key keeps repeated runs on
 * the same day idempotent.
 */
export async function evaluateAlerts(date: Date): Promise<{ triggered: TriggeredAlert[]; errors: string[] }> {
  const errors: string[] = [];
  const triggered: TriggeredAlert[] = [];

  const rules = await db.watchlistItem.findMany({
    where: { targetPrice: { not: null } },
    include: { card: { select: { id: true, name: true } } },
  });

  // "Has this rule ever fired?" in one query instead of one lookup per rule.
  const firedRows = rules.length
    ? await db.priceAlert.findMany({
        where: {
          OR: rules.map((r) => ({ userId: r.userId, cardId: r.cardId, grade: r.grade ?? "raw" })),
        },
        select: { userId: true, cardId: true, grade: true },
      })
    : [];
  const everFired = new Set(firedRows.map((a) => `${a.userId}|${a.cardId}|${a.grade}`));

  for (const rule of rules) {
    // Isolate each rule: one broken card must not stop the remaining alerts.
    try {
      const grade: Grade = rule.grade ?? "raw";
      const targetPriceEur = Number(rule.targetPrice);

      // Two indexed lookups per rule — watchlists hold a handful of cards for a few collectors,
      // so this stays cheap; batch by (cardId, grade) if a watchlist ever grows large.
      const [current, previous] = await Promise.all([
        db.priceSnapshot.findFirst({
          where: { cardId: rule.cardId, grade, date: { lte: date } },
          orderBy: { date: "desc" },
        }),
        db.priceSnapshot.findFirst({
          where: { cardId: rule.cardId, grade, date: { lt: date } },
          orderBy: { date: "desc" },
        }),
      ]);
      if (!current) continue;

      const priceEur = Number(current.priceEur);
      const hasFired = everFired.has(`${rule.userId}|${rule.cardId}|${grade}`);
      const previousPriceEur = hasFired && previous ? Number(previous.priceEur) : null;
      if (!isAlertTriggered(previousPriceEur, priceEur, targetPriceEur)) continue;

      const { count } = await db.priceAlert.createMany({
        data: [
          {
            userId: rule.userId,
            cardId: rule.cardId,
            grade,
            targetPrice: targetPriceEur,
            priceEur,
            snapshotDate: current.date,
          },
        ],
        skipDuplicates: true,
      });

      if (count > 0) {
        everFired.add(`${rule.userId}|${rule.cardId}|${grade}`);
        triggered.push({ cardId: rule.cardId, cardName: rule.card.name, grade, targetPriceEur, priceEur });
      }
    } catch (e) {
      errors.push(`alert:${rule.cardId}:${String(e)}`);
    }
  }

  if (triggered.length > 0) await notifyWebhook(triggered);

  return { triggered, errors };
}

/**
 * Optional outbound notification. Set ALERT_WEBHOOK_URL to a Discord/Slack-style incoming webhook
 * and a short summary is posted whenever alerts fire; without it alerts live in the app only.
 * Failures are swallowed on purpose — a dead webhook must never fail the price sync.
 */
async function notifyWebhook(alerts: TriggeredAlert[]): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const lines = alerts.map(
    (a) => `• ${a.cardName} (${GRADE_LABEL[a.grade]}): ${formatEur(a.priceEur)} ≤ Ziel ${formatEur(a.targetPriceEur)}`,
  );
  const text = `Zielpreis erreicht:\n${lines.join("\n")}`;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Discord expects `content`, Slack `text` — sending both keeps one env var enough.
      body: JSON.stringify({ content: text, text }),
    });
  } catch {
    /* best effort: the alert is stored and visible in the app either way */
  }
}
