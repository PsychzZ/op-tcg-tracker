import "dotenv/config";
import { db } from "../src/lib/db";
import { extractPcImageUrl } from "../src/domain/pricecharting-image";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchImage(pcId: string): Promise<string | null> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(`https://www.pricecharting.com/offers?product=${pcId}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (res.ok) return extractPcImageUrl(await res.text(), 1600);
      if (res.status === 429) await sleep(3000);
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return null;
}

async function main() {
  const force = process.argv.includes("--force");
  const cards = await db.card.findMany({ select: { id: true, name: true, imageUrl: true, providerIds: true } });
  const targets = cards.filter(
    (c) =>
      (c.providerIds as Record<string, string> | null)?.priceCharting &&
      (force || !(c.imageUrl ?? "").startsWith("https://commondatastorage")),
  );
  console.log(`Backfilling PriceCharting images for ${targets.length} cards ...`);

  let ok = 0;
  let miss = 0;
  for (const c of targets) {
    const pcId = (c.providerIds as Record<string, string>).priceCharting;
    const url = await fetchImage(pcId);
    if (url) {
      await db.card.update({ where: { id: c.id }, data: { imageUrl: url } });
      ok++;
    } else {
      miss++;
    }
    if ((ok + miss) % 25 === 0) console.log(`  ${ok + miss}/${targets.length} (ok=${ok} miss=${miss})`);
    await sleep(1200);
  }
  console.log(`Done. images set=${ok}, missing=${miss}`);
}

main().finally(() => db.$disconnect());
