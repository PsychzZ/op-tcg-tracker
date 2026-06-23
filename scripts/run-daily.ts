import "dotenv/config";
import { db } from "../src/lib/db";
import { runDailyUpdate } from "../src/services/daily-update";

runDailyUpdate()
  .then((r) => console.log("Done:", r))
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());
