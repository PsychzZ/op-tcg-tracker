import "dotenv/config";
import { db } from "../src/lib/db";
import { parseConsoleSlugs, parseConsoleRows, consoleSlugToName } from "../src/domain/pricecharting-console";
import { classifyPcCard } from "../src/domain/pricecharting-catalog";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const CATEGORY = "https://www.pricecharting.com/category/one-piece-cards";

async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) return await res.text();
      if (res.status === 429) await sleep(3000);
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return "";
}

async function main() {
  const countOnly = process.argv.includes("--count");
  const minArg = process.argv.find((a) => a.startsWith("--min="));
  const minUsd = minArg ? parseFloat(minArg.split("=")[1]) : 11; // ~€10
  const minCents = Math.round(minUsd * 100);

  const slugs = parseConsoleSlugs(await fetchText(CATEGORY));
  console.log(`Found ${slugs.length} Japanese sets. Keeping cards with raw ≥ $${minUsd}.${countOnly ? " (count only)" : ""}\n`);

  let scanned = 0;
  let eligible = 0;
  let imported = 0;
  for (const slug of slugs) {
    const rows = parseConsoleRows(await fetchText(`https://www.pricecharting.com/console/${slug}`));
    scanned += rows.length;
    const consoleName = consoleSlugToName(slug);
    let setEligible = 0;
    for (const row of rows) {
      if (row.loosePriceCents < minCents) continue;
      const card = classifyPcCard({ id: row.id, "console-name": consoleName, "product-name": row.name });
      if (!card) continue; // DON etc.
      eligible++;
      setEligible++;
      if (!countOnly) {
        await db.card.upsert({
          where: { externalId: card.externalId },
          update: {
            name: card.name, setCode: card.setCode, number: card.number,
            rarity: card.rarity, variant: card.variant, category: card.category, providerIds: card.providerIds,
          },
          create: {
            externalId: card.externalId, name: card.name, setCode: card.setCode, number: card.number,
            rarity: card.rarity, variant: card.variant, category: card.category, language: card.language, providerIds: card.providerIds,
          },
        });
        imported++;
      }
    }
    console.log(`  ${slug}: ${rows.length} cards, ${setEligible} eligible`);
    await sleep(1200);
  }
  console.log(`\nScanned ${scanned} cards across ${slugs.length} sets → ${eligible} with raw ≥ $${minUsd}.`);
  if (!countOnly) console.log(`Imported/updated ${imported}.`);
}

main().finally(() => db.$disconnect());
