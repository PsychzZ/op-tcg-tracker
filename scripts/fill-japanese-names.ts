import "dotenv/config";
import { db } from "../src/lib/db";
import { fillJapaneseNames } from "../src/services/japanese-names";

/**
 * Fill the Japanese names (`Card.nameJp`) from the official card list on onepiece-cardgame.com.
 *
 * The official site is the only source with the Japanese names, and it keys cards by the same number
 * we store, so this walks its series pages and matches on that number. Cards whose number is not on
 * the pages we fetched are reported as `missing` and left untouched — nothing is guessed.
 *
 * Usage:
 *   npm run fill:names -- [--max-series=10] [--refill]
 *
 * `--max-series` stops after N series pages (each holds ~169 cards, ~1 s apart); `--refill` also
 * overwrites names that are already stored.
 */
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`));

async function main() {
  const maxSeriesRaw = arg("max-series")?.split("=")[1];
  const refill = process.argv.includes("--refill");

  console.log(
    `Filling Japanese names${refill ? " (overwriting existing)" : ""}` +
      `${maxSeriesRaw ? `, at most ${maxSeriesRaw} series pages` : ""} …`,
  );

  const result = await fillJapaneseNames({
    maxSeries: maxSeriesRaw ? Number(maxSeriesRaw) : undefined,
    refill,
  });

  console.log(
    `Series ${result.series} · entries ${result.entries} · candidates ${result.candidates} · ` +
      `updated ${result.updated} · missing ${result.missing}`,
  );
  if (result.missing > 0) {
    console.log(
      "Cards reported as missing have no matching number in the pages fetched — try again with more " +
        "series pages (a full run is ~60 pages).",
    );
  }
  if (result.errors.length) {
    console.warn(`${result.errors.length} series page(s) failed:`, result.errors.slice(0, 5));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
