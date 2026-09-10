import "dotenv/config";
import { db } from "../src/lib/db";
import { refreshCatalog } from "../src/services/catalog-refresh";

/**
 * Refresh the shared catalog from PriceCharting's Japanese category page.
 *
 * Every row goes through the same classifier and trackability rule the rest of the app uses, so
 * rows land complete: the card number, the set/category derived from that number, the variant and an
 * image that matches the variant (see src/services/catalog-refresh.ts). The same service backs the
 * weekly `/api/cron/catalog` endpoint.
 *
 * Usage: `npm run job:catalog -- --min=11 [--max-sets=5] [--no-images]`
 */
const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`));

async function main() {
  const minUsd = Number(arg("min")?.split("=")[1] ?? 11);
  const maxSetsRaw = arg("max-sets")?.split("=")[1];
  const fetchImages = !process.argv.includes("--no-images");

  console.log(
    `Refreshing catalog: raw ≥ $${minUsd}` +
      `${maxSetsRaw ? `, first ${maxSetsRaw} sets` : ""}` +
      `${fetchImages ? "" : ", without images"} …`,
  );

  const result = await refreshCatalog({
    minPriceUsd: minUsd,
    maxSets: maxSetsRaw ? Number(maxSetsRaw) : undefined,
    fetchImages,
  });

  console.log(
    `Sets ${result.sets} · scanned ${result.scanned} · eligible ${result.eligible} · ` +
      `new ${result.created} · updated ${result.updated} · images ${result.imagesStored}`,
  );
  if (result.errors.length) {
    console.warn(`${result.errors.length} set(s) failed:`, result.errors.slice(0, 5));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
