import "dotenv/config";
import { readFileSync, existsSync } from "node:fs";
import { db } from "../src/lib/db";
import { importCatalog } from "../src/services/catalog-import";
import type { RawCatalogCard } from "../src/domain/catalog";

async function main() {
  const path = existsSync("data/cards.ja.json")
    ? "data/cards.ja.json"
    : "data/cards.sample.json";
  console.log(`Importing from ${path} ...`);
  const rawCards = JSON.parse(readFileSync(path, "utf8")) as RawCatalogCard[];
  const result = await importCatalog(rawCards);
  console.log(`Imported ${result.imported}, skipped ${result.skipped}.`);
}

main().finally(() => db.$disconnect());
