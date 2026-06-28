import "dotenv/config";
import { db } from "../src/lib/db";
import { runPriceSync } from "../src/services/price-sync";

runPriceSync()
  .then((r) => console.log("Done:", r))
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());
