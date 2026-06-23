import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.mts";

// Integration tests live in *.itest.ts and run against the dev DB.
// The default config's include intentionally excludes them so `npm test`
// (unit) stays fast and DB-free; this config opts them in explicitly.
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ["src/**/*.itest.ts"],
    },
  }),
);
