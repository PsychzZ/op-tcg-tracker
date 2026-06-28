import "dotenv/config";
import { db } from "../src/lib/db";
import { importFromPriceCharting } from "../src/services/pricecharting-import";

// Popular characters whose special/rare Japanese cards we want in the catalog.
// Extend this list anytime — the importer dedupes and keeps only trackable JP specials.
const QUERIES = [
  // Straw Hat crew
  "Luffy one piece",
  "Roronoa Zoro one piece",
  "Nami one piece",
  "Usopp one piece",
  "Sanji one piece",
  "Tony Tony Chopper one piece",
  "Nico Robin one piece",
  "Franky one piece",
  "Brook one piece",
  "Jinbe one piece",
  // Allies & family
  "Portgas Ace one piece",
  "Sabo one piece",
  "Shanks one piece",
  "Trafalgar Law one piece",
  "Boa Hancock one piece",
  "Yamato one piece",
  "Carrot one piece",
  "Nefertari Vivi one piece",
  "Vinsmoke Reiju one piece",
  "Koby one piece",
  "Uta one piece",
  "Bonney one piece",
  "Bartolomeo one piece",
  "Cavendish one piece",
  "Perona one piece",
  "Rebecca one piece",
  // Marines & government
  "Monkey D. Garp one piece",
  "Sengoku one piece",
  "Sakazuki Akainu one piece",
  "Kuzan Aokiji one piece",
  "Borsalino Kizaru one piece",
  "Smoker one piece",
  "Tashigi one piece",
  "Rob Lucci one piece",
  // Emperors, warlords & antagonists
  "Kaido one piece",
  "Charlotte Linlin one piece",
  "Charlotte Katakuri one piece",
  "Marco one piece",
  "Edward Newgate Whitebeard one piece",
  "Doflamingo one piece",
  "Crocodile one piece",
  "Dracule Mihawk one piece",
  "Buggy one piece",
  "Eustass Kid one piece",
  "Killer one piece",
  "King one piece",
  "Queen one piece",
  "Enel one piece",
  "Gecko Moria one piece",
  "Donquixote Rosinante one piece",
];

async function main() {
  const token = process.env.PRICECHARTING_TOKEN;
  if (!token) throw new Error("Set PRICECHARTING_TOKEN in .env");
  console.log(`Searching PriceCharting for ${QUERIES.length} queries ...`);
  const result = await importFromPriceCharting(QUERIES, token);
  console.log(`Imported ${result.imported}, skipped ${result.skipped}.`);
}

main().finally(() => db.$disconnect());
