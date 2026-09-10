import { db } from "@/lib/db";
import { convertToEur } from "@/domain/fx";
import { fetchEcbRates } from "@/lib/providers/ecb-fx";
import { parseConsoleSlugs, parseConsoleRows, type ConsoleRow } from "@/domain/pricecharting-console";
import { PC_CATEGORY_URL, PC_CONSOLE_URL, fetchText, sleep } from "@/lib/providers/pricecharting-scrape";
import { evaluateAlerts } from "@/services/alerts";
import type { Grade } from "@/domain/card";

function utcMidnight(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

const GRADE_FIELDS: Array<[keyof ConsoleRow, Grade]> = [
  ["loosePriceCents", "raw"],
  ["psa9PriceCents", "psa9"],
  ["psa10PriceCents", "psa10"],
];

/**
 * Update all prices by scraping PriceCharting console pages once per set (~66 requests total),
 * which expose Ungraded / Grade 9 / PSA 10 for every card. Far faster than per-card API calls and
 * gives PSA prices without eBay. Matches rows to our cards by stored PriceCharting product id.
 */
export async function runPriceSync() {
  const run = await db.syncRun.create({ data: { status: "running" } });
  const errors: string[] = [];
  let updated = 0;

  try {
    const rates = await fetchEcbRates();
    const date = utcMidnight();
    for (const [currency, rate] of Object.entries(rates)) {
      await db.fxRate.upsert({
        where: { date_currency: { date, currency } },
        update: { rate },
        create: { date, currency, rate },
      });
    }
    const usdRate = rates["USD"];
    if (!usdRate) throw new Error("no USD FX rate available");

    const cards = await db.card.findMany({ select: { id: true, providerIds: true } });
    const byPcId = new Map<string, string>();
    const ownedConsoles = new Set<string>();
    for (const c of cards) {
      const ids = c.providerIds as Record<string, string> | null;
      const pid = ids?.priceCharting;
      if (pid) byPcId.set(String(pid), c.id);
      // Non-JP sets we own cards from (e.g. Western promos/collabs) aren't on the JP category page.
      const console = ids?.priceChartingConsole;
      if (console) ownedConsoles.add(console);
    }

    // JP sets from the category page, plus any extra console a stored card points to.
    const slugs = [...new Set([...parseConsoleSlugs(await fetchText(PC_CATEGORY_URL)), ...ownedConsoles])];
    for (const slug of slugs) {
      const rows = parseConsoleRows(await fetchText(PC_CONSOLE_URL(slug)));
      const ops = [];
      for (const row of rows) {
        const cardId = byPcId.get(row.id);
        if (!cardId) continue;
        for (const [field, grade] of GRADE_FIELDS) {
          const cents = row[field] as number;
          if (!cents) continue;
          const priceNative = cents / 100;
          const priceEur = convertToEur(priceNative, "USD", rates);
          ops.push(
            db.priceSnapshot.upsert({
              where: { cardId_grade_date: { cardId, grade, date } },
              update: { priceNative, currency: "USD", priceEur, fxRate: usdRate, source: "priceCharting", sampleSize: null },
              create: { cardId, grade, date, priceNative, currency: "USD", priceEur, fxRate: usdRate, source: "priceCharting", sampleSize: null },
            }),
          );
        }
      }
      if (ops.length) {
        try {
          await db.$transaction(ops);
          updated += ops.length;
        } catch (e) {
          errors.push(`${slug}:${String(e)}`);
        }
      }
      await sleep(1200);
    }

    // Target-price alerts ride along with the price sync: crossings are detected against the
    // snapshots written above, so an alert can never lag behind the prices that caused it.
    let alerts = 0;
    try {
      const alertRun = await evaluateAlerts(date);
      alerts = alertRun.triggered.length;
      errors.push(...alertRun.errors);
    } catch (e) {
      errors.push(`alerts:${String(e)}`);
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "success", finishedAt: new Date(), cardsUpdated: updated, errors: errors.length ? errors : undefined },
    });
    return { updated, alerts, errors };
  } catch (e) {
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "failed", finishedAt: new Date(), cardsUpdated: updated, errors: [String(e), ...errors] },
    });
    throw e;
  }
}
