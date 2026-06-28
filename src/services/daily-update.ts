import { db } from "@/lib/db";
import { isTrackable, type Grade } from "@/domain/card";
import { convertToEur } from "@/domain/fx";
import { resolvePrice } from "@/domain/price-resolver";
import { fetchEcbRates } from "@/lib/providers/ecb-fx";
import { priceChartingProvider } from "@/lib/providers/pricecharting";
import { ebaySoldProvider } from "@/lib/providers/ebay-sold";
import type { ProviderPrice } from "@/lib/providers/types";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];
// Raw comes from PriceCharting (aggregated market price); PSA 9/10 from eBay-sold.
const PROVIDERS = [priceChartingProvider, ebaySoldProvider];

function utcMidnight(): Date {
  return new Date(new Date().toISOString().slice(0, 10));
}

export async function runDailyUpdate() {
  const run = await db.syncRun.create({ data: { status: "running" } });
  const errors: string[] = [];
  let cardsUpdated = 0;

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

    // eBay-sold (Apify) is metered, so we only query PSA prices for cards a user
    // actually owns or watches — not the whole catalog. Raw stays catalog-wide.
    const [collected, watched] = await Promise.all([
      db.collectionItem.findMany({ select: { cardId: true } }),
      db.watchlistItem.findMany({ select: { cardId: true } }),
    ]);
    const ownedOrWatched = new Set<string>([
      ...collected.map((c) => c.cardId),
      ...watched.map((w) => w.cardId),
    ]);

    const cards = await db.card.findMany();
    for (const card of cards) {
      if (!isTrackable(card)) continue;

      const perGrade = new Map<Grade, ProviderPrice[]>();
      for (const provider of PROVIDERS) {
        if (provider.name === "ebaySold" && !ownedOrWatched.has(card.id)) continue;
        let prices: ProviderPrice[] = [];
        try {
          prices = await provider.getPrices(card, GRADES);
        } catch (e) {
          errors.push(`${provider.name}:${card.externalId}:${String(e)}`);
        }
        for (const p of prices) {
          const arr = perGrade.get(p.grade) ?? [];
          arr.push(p);
          perGrade.set(p.grade, arr);
        }
      }

      for (const grade of GRADES) {
        const chosen = resolvePrice(perGrade.get(grade) ?? []);
        if (!chosen) continue;
        // Isolate each grade: a bad/unknown currency must not abort the whole run.
        try {
          const fxRate = chosen.currency === "EUR" ? 1 : rates[chosen.currency];
          if (!fxRate) {
            errors.push(`fx:${card.externalId}:${grade}:no rate for ${chosen.currency}`);
            continue;
          }
          const priceEur = convertToEur(chosen.priceNative, chosen.currency, rates);

          await db.priceSnapshot.upsert({
            where: { cardId_grade_date: { cardId: card.id, grade, date } },
            update: {
              priceNative: chosen.priceNative,
              currency: chosen.currency,
              priceEur,
              fxRate,
              source: chosen.source,
              sampleSize: chosen.sampleSize ?? null,
            },
            create: {
              cardId: card.id,
              grade,
              date,
              priceNative: chosen.priceNative,
              currency: chosen.currency,
              priceEur,
              fxRate,
              source: chosen.source,
              sampleSize: chosen.sampleSize ?? null,
            },
          });

          if (chosen.observations?.length) {
            await db.saleObservation.createMany({
              data: chosen.observations.map((o) => ({
                cardId: card.id,
                grade,
                saleDate: o.saleDate,
                priceNative: o.priceNative,
                currency: o.currency,
                priceEur: convertToEur(o.priceNative, o.currency, rates),
                source: chosen.source,
                url: o.url,
              })),
              skipDuplicates: true,
            });
          }
          cardsUpdated++;
        } catch (e) {
          errors.push(`snapshot:${card.externalId}:${grade}:${String(e)}`);
        }
      }
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        cardsUpdated,
        errors: errors.length ? errors : undefined,
      },
    });
    return { cardsUpdated, errors };
  } catch (e) {
    await db.syncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        cardsUpdated,
        errors: [String(e), ...errors],
      },
    });
    throw e;
  }
}
