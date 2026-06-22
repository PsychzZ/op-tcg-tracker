# Pricing Engine — Implementation Plan (4/5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Daily, idempotent multi-source pricing: pluggable providers (eBay-Sold + free API), a resolver that picks the best price per card/grade with provenance, ECB-based EUR conversion, `PriceSnapshot`/`SaleObservation` writes, and a secret-protected daily cron — so charts have data that grows from day one.

**Architecture:** Pure logic (`fx`, `price-resolver`, `money`, provider response mappers) lives in `src/domain` and is unit-tested. Providers implement a common `PriceProvider` interface in `src/lib/providers/*` and **gracefully return `[]` when not configured**, so the pipeline runs end-to-end even before API keys exist. `runDailyUpdate()` (in `src/services`) orchestrates fetch→resolve→convert→upsert; it is invoked by both the cron route and a local script.

**Tech Stack:** Prisma, Next.js route handler, Vercel Cron, ECB euro FX reference XML.

**Prerequisites:** Plans 1–3 complete (`Card`, `PriceSnapshot`, `SaleObservation`, `FxRate`, `SyncRun`, `db`, catalog populated).

**Reference spec:** `docs/superpowers/specs/2026-06-22-op-tcg-tracker-design.md` (§5 Preise & Historie, §8 Cron)

**Testing strategy:** `fx`, `price-resolver`, `money`, and provider response mappers → Vitest unit tests (TDD). Orchestration + cron → run the local `job:daily` script and inspect the DB. **External API response shapes (free API, eBay-sold) are mapped via fixture-tested functions with an explicit verification step** — confirm the real shapes and adjust the mapper/fixture when wiring real keys.

---

## File Structure (created/modified by this plan)

- `prisma/schema.prisma` — add `@@unique` to `SaleObservation` (+ migration)
- `src/domain/money.ts` (+ `.test.ts`) — `formatEur`, `round2`
- `src/domain/fx.ts` (+ `.test.ts`) — `convertToEur`
- `src/domain/price-resolver.ts` (+ `.test.ts`) — `resolvePrice`
- `src/lib/providers/types.ts` — `PriceProvider`, `ProviderPrice`
- `src/lib/providers/free-api.ts` (+ `free-api.test.ts`) — `mapFreeApiResponse`, `freeApiProvider`
- `src/lib/providers/ebay-sold.ts` (+ `ebay-sold.test.ts`) — `mapEbaySoldResponse`, `ebaySoldProvider`
- `src/lib/providers/ecb-fx.ts` — `fetchEcbRates`
- `src/services/daily-update.ts` — `runDailyUpdate()`
- `src/app/api/cron/daily/route.ts` — secret-protected cron
- `scripts/run-daily.ts` — local invoke; `package.json` `job:daily`
- `vercel.json` — cron schedule
- `.env` / `.env.example` — `CRON_SECRET`, `FREE_API_BASE`, `FREE_API_KEY`, `EBAY_SOLD_BASE`, `EBAY_SOLD_KEY`

---

## Task 1: SaleObservation uniqueness (for dedupe)

**Files:** Modify `prisma/schema.prisma`

- [ ] **Step 1: Add a compound unique** to `model SaleObservation` (so repeated cron runs don't duplicate sales):

```prisma
  @@unique([cardId, grade, saleDate, priceNative, source])
```

(Place it alongside the existing `@@index([cardId, grade])`.)

- [ ] **Step 2: Migrate**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npx prisma migrate dev --name sale_observation_unique
```

Expected: "Your database is now in sync with your schema."

- [ ] **Step 3: Commit**

```bash
git add prisma
git commit -m "feat: add SaleObservation dedupe unique constraint"
```

---

## Task 2: Money helpers (TDD)

**Files:** Create `src/domain/money.ts`, `src/domain/money.test.ts`

- [ ] **Step 1: Failing test**

`src/domain/money.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { round2, formatEur } from "./money";

describe("round2", () => {
  it("rounds to 2 decimals", () => {
    expect(round2(10.005)).toBe(10.01);
    expect(round2(99.999)).toBe(100);
  });
});

describe("formatEur", () => {
  it("formats euros in de-DE style", () => {
    const s = formatEur(1234.5);
    expect(s).toContain("€");
    expect(s).toContain("1.234");
  });
});
```

- [ ] **Step 2: Run → fail**

```bash
npm test -- src/domain/money.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement** `src/domain/money.ts`:

```ts
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

export function formatEur(n: number): string {
  return eur.format(n);
}
```

- [ ] **Step 4: Run → pass**

```bash
npm test -- src/domain/money.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/money.ts src/domain/money.test.ts
git commit -m "feat: add money round/format helpers"
```

---

## Task 3: FX conversion (TDD)

**Files:** Create `src/domain/fx.ts`, `src/domain/fx.test.ts`

- [ ] **Step 1: Failing test**

`src/domain/fx.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { convertToEur, type RatesPerEur } from "./fx";

const rates: RatesPerEur = { USD: 1.08, JPY: 170 };

describe("convertToEur", () => {
  it("passes EUR through unchanged", () => {
    expect(convertToEur(100, "EUR", rates)).toBe(100);
  });
  it("converts USD using rate (currency per 1 EUR)", () => {
    expect(convertToEur(108, "USD", rates)).toBe(100);
  });
  it("converts JPY", () => {
    expect(convertToEur(1700, "JPY", rates)).toBe(10);
  });
  it("throws for an unknown currency", () => {
    expect(() => convertToEur(10, "GBP", rates)).toThrow();
  });
});
```

- [ ] **Step 2: Run → fail**

```bash
npm test -- src/domain/fx.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement** `src/domain/fx.ts`:

```ts
import { round2 } from "./money";

export type RatesPerEur = Record<string, number>;

/** rates are units of `currency` per 1 EUR (ECB convention). */
export function convertToEur(amount: number, currency: string, rates: RatesPerEur): number {
  if (currency === "EUR") return round2(amount);
  const rate = rates[currency];
  if (!rate) throw new Error(`No FX rate for ${currency}`);
  return round2(amount / rate);
}
```

- [ ] **Step 4: Run → pass**

```bash
npm test -- src/domain/fx.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/fx.ts src/domain/fx.test.ts
git commit -m "feat: add EUR FX conversion"
```

---

## Task 4: Price resolver (TDD)

**Files:** Create `src/lib/providers/types.ts`, `src/domain/price-resolver.ts`, `src/domain/price-resolver.test.ts`

- [ ] **Step 1: Provider types**

`src/lib/providers/types.ts`:

```ts
import type { Grade } from "@/domain/card";
import type { PriceSource } from "@prisma/client";
import type { Card } from "@prisma/client";

export interface SaleObs {
  saleDate: Date;
  priceNative: number;
  currency: string;
  url?: string;
}

export interface ProviderPrice {
  grade: Grade;
  priceNative: number;
  currency: string;
  source: PriceSource;
  sampleSize?: number;
  observations?: SaleObs[];
}

export interface PriceProvider {
  name: PriceSource;
  getPrices(card: Card, grades: Grade[]): Promise<ProviderPrice[]>;
}
```

- [ ] **Step 2: Failing test**

`src/domain/price-resolver.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolvePrice } from "./price-resolver";
import type { ProviderPrice } from "@/lib/providers/types";

const ebay = (sampleSize: number): ProviderPrice => ({ grade: "psa10", priceNative: 100, currency: "USD", source: "ebaySold", sampleSize });
const free = (): ProviderPrice => ({ grade: "psa10", priceNative: 90, currency: "USD", source: "freeApi" });

describe("resolvePrice", () => {
  it("prefers eBay-sold with enough samples", () => {
    expect(resolvePrice([free(), ebay(5)])?.source).toBe("ebaySold");
  });
  it("falls back to free API when eBay samples are too thin", () => {
    expect(resolvePrice([free(), ebay(1)])?.source).toBe("freeApi");
  });
  it("uses thin eBay data when nothing else exists", () => {
    expect(resolvePrice([ebay(1)])?.source).toBe("ebaySold");
  });
  it("returns null when there is no data", () => {
    expect(resolvePrice([])).toBeNull();
  });
});
```

- [ ] **Step 3: Run → fail**

```bash
npm test -- src/domain/price-resolver.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement** `src/domain/price-resolver.ts`:

```ts
import type { ProviderPrice } from "@/lib/providers/types";

const MIN_SAMPLE = 3;

/** Priority: eBay-sold (enough samples) > free API > thin eBay-sold > none. */
export function resolvePrice(results: ProviderPrice[], minSample = MIN_SAMPLE): ProviderPrice | null {
  const ebay = results.find((r) => r.source === "ebaySold");
  const free = results.find((r) => r.source === "freeApi");
  if (ebay && (ebay.sampleSize ?? 0) >= minSample) return ebay;
  if (free) return free;
  if (ebay) return ebay;
  return null;
}
```

- [ ] **Step 5: Run → pass**

```bash
npm test -- src/domain/price-resolver.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/types.ts src/domain/price-resolver.ts src/domain/price-resolver.test.ts
git commit -m "feat: add price resolver with source priority"
```

---

## Task 5: Providers (free API + eBay-sold) with tested mappers

> Both providers return `[]` when their env config is missing, so the pipeline runs before keys exist. The **mapper** is fixture-tested; the **fetch** must be verified against the real API when keys are added.

**Files:** Create `src/lib/providers/free-api.ts`, `src/lib/providers/free-api.test.ts`, `src/lib/providers/ebay-sold.ts`, `src/lib/providers/ebay-sold.test.ts`

- [ ] **Step 1: Free-API mapper test**

`src/lib/providers/free-api.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapFreeApiResponse } from "./free-api";

// Representative shape — VERIFY against the real API and adjust if different.
const fixture = {
  data: [
    { grade: "raw", price: 210, currency: "USD" },
    { grade: "PSA 9", price: 430, currency: "USD" },
    { grade: "PSA 10", price: 980, currency: "USD" },
    { grade: "BGS 9.5", price: 700, currency: "USD" },
  ],
};

describe("mapFreeApiResponse", () => {
  it("maps known grades and ignores unsupported ones", () => {
    const prices = mapFreeApiResponse(fixture);
    expect(prices).toHaveLength(3);
    expect(prices.find((p) => p.grade === "psa10")?.priceNative).toBe(980);
    expect(prices.every((p) => p.source === "freeApi")).toBe(true);
  });
});
```

- [ ] **Step 2: Implement free-api provider**

`src/lib/providers/free-api.ts`:

```ts
import type { Card } from "@prisma/client";
import type { Grade } from "@/domain/card";
import type { PriceProvider, ProviderPrice } from "./types";

function normalizeGrade(raw: string): Grade | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "RAW" || s === "UNGRADED" || s === "NM") return "raw";
  if (s === "PSA9") return "psa9";
  if (s === "PSA10") return "psa10";
  return null;
}

interface FreeApiShape {
  data?: Array<{ grade: string; price: number; currency: string }>;
}

export function mapFreeApiResponse(json: FreeApiShape): ProviderPrice[] {
  const out: ProviderPrice[] = [];
  for (const row of json.data ?? []) {
    const grade = normalizeGrade(row.grade);
    if (!grade) continue;
    out.push({ grade, priceNative: row.price, currency: row.currency, source: "freeApi" });
  }
  return out;
}

export const freeApiProvider: PriceProvider = {
  name: "freeApi",
  async getPrices(card: Card, _grades: Grade[]): Promise<ProviderPrice[]> {
    const base = process.env.FREE_API_BASE;
    const key = process.env.FREE_API_KEY;
    if (!base || !key) return []; // not configured yet → graceful no-op
    const ids = (card.providerIds as Record<string, string> | null) ?? {};
    const ref = ids.freeApi ?? card.externalId;
    const res = await fetch(`${base}/cards/${encodeURIComponent(ref)}/prices`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    return mapFreeApiResponse(await res.json());
  },
};
```

- [ ] **Step 3: eBay-sold mapper test**

`src/lib/providers/ebay-sold.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapEbaySoldResponse } from "./ebay-sold";

// Representative shape — VERIFY against the real source and adjust if different.
const fixture = {
  results: [
    {
      grade: "PSA 10",
      median: 980,
      currency: "USD",
      sampleSize: 7,
      sales: [{ date: "2026-06-18", price: 990, currency: "USD", url: "https://ebay.com/itm/1" }],
    },
    { grade: "raw", median: 210, currency: "USD", sampleSize: 12, sales: [] },
  ],
};

describe("mapEbaySoldResponse", () => {
  it("maps medians, sample sizes, and observations", () => {
    const prices = mapEbaySoldResponse(fixture);
    const psa10 = prices.find((p) => p.grade === "psa10")!;
    expect(psa10.priceNative).toBe(980);
    expect(psa10.sampleSize).toBe(7);
    expect(psa10.source).toBe("ebaySold");
    expect(psa10.observations?.[0]?.priceNative).toBe(990);
  });
});
```

- [ ] **Step 4: Implement eBay-sold provider**

`src/lib/providers/ebay-sold.ts`:

```ts
import type { Card } from "@prisma/client";
import type { Grade } from "@/domain/card";
import type { PriceProvider, ProviderPrice } from "./types";

function normalizeGrade(raw: string): Grade | null {
  const s = raw.trim().toUpperCase().replace(/\s+/g, "");
  if (s === "RAW" || s === "UNGRADED") return "raw";
  if (s === "PSA9") return "psa9";
  if (s === "PSA10") return "psa10";
  return null;
}

interface EbaySoldShape {
  results?: Array<{
    grade: string;
    median: number;
    currency: string;
    sampleSize: number;
    sales?: Array<{ date: string; price: number; currency: string; url?: string }>;
  }>;
}

export function mapEbaySoldResponse(json: EbaySoldShape): ProviderPrice[] {
  const out: ProviderPrice[] = [];
  for (const row of json.results ?? []) {
    const grade = normalizeGrade(row.grade);
    if (!grade) continue;
    out.push({
      grade,
      priceNative: row.median,
      currency: row.currency,
      source: "ebaySold",
      sampleSize: row.sampleSize,
      observations: (row.sales ?? []).map((s) => ({
        saleDate: new Date(s.date),
        priceNative: s.price,
        currency: s.currency,
        url: s.url,
      })),
    });
  }
  return out;
}

export const ebaySoldProvider: PriceProvider = {
  name: "ebaySold",
  async getPrices(card: Card, _grades: Grade[]): Promise<ProviderPrice[]> {
    const base = process.env.EBAY_SOLD_BASE;
    const key = process.env.EBAY_SOLD_KEY;
    if (!base || !key) return []; // not configured yet → graceful no-op
    const query = `${card.name} ${card.number ?? ""} japanese`.trim();
    const res = await fetch(`${base}/sold?q=${encodeURIComponent(query)}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return [];
    return mapEbaySoldResponse(await res.json());
  },
};
```

- [ ] **Step 5: Run mapper tests → pass**

```bash
npm test -- src/lib/providers
```

Expected: PASS (both mapper test files).

- [ ] **Step 6: Commit**

```bash
git add src/lib/providers/free-api.ts src/lib/providers/free-api.test.ts src/lib/providers/ebay-sold.ts src/lib/providers/ebay-sold.test.ts
git commit -m "feat: add free-API and eBay-sold price providers (graceful, fixture-tested)"
```

---

## Task 6: ECB FX fetcher

**Files:** Create `src/lib/providers/ecb-fx.ts`

- [ ] **Step 1: Implement** `src/lib/providers/ecb-fx.ts`:

```ts
import type { RatesPerEur } from "@/domain/fx";

const ECB_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";
const WANTED = ["USD", "JPY"];

/** Returns units of currency per 1 EUR, e.g. { USD: 1.08, JPY: 170.5 }. */
export async function fetchEcbRates(): Promise<RatesPerEur> {
  const res = await fetch(ECB_URL);
  if (!res.ok) throw new Error(`ECB fetch failed: ${res.status}`);
  const xml = await res.text();
  const rates: RatesPerEur = {};
  for (const cur of WANTED) {
    const m = xml.match(new RegExp(`currency=['"]${cur}['"]\\s+rate=['"]([0-9.]+)['"]`));
    if (m) rates[cur] = Number(m[1]);
  }
  if (Object.keys(rates).length === 0) throw new Error("No ECB rates parsed");
  return rates;
}
```

- [ ] **Step 2: Quick manual sanity check**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npx tsx -e "import('./src/lib/providers/ecb-fx').then(m=>m.fetchEcbRates()).then(r=>console.log(r))"
```

Expected: something like `{ USD: 1.0x, JPY: 1xx.x }`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/providers/ecb-fx.ts
git commit -m "feat: add ECB euro FX rate fetcher"
```

---

## Task 7: Daily update orchestration

**Files:** Create `src/services/daily-update.ts`

- [ ] **Step 1: Implement** `src/services/daily-update.ts`:

```ts
import { db } from "@/lib/db";
import { isTrackable, type Grade } from "@/domain/card";
import { convertToEur } from "@/domain/fx";
import { resolvePrice } from "@/domain/price-resolver";
import { fetchEcbRates } from "@/lib/providers/ecb-fx";
import { freeApiProvider } from "@/lib/providers/free-api";
import { ebaySoldProvider } from "@/lib/providers/ebay-sold";
import type { ProviderPrice } from "@/lib/providers/types";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];
const PROVIDERS = [ebaySoldProvider, freeApiProvider];

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

    const cards = await db.card.findMany();
    for (const card of cards) {
      if (!isTrackable(card)) continue;

      const perGrade = new Map<Grade, ProviderPrice[]>();
      for (const provider of PROVIDERS) {
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
        const priceEur = convertToEur(chosen.priceNative, chosen.currency, rates);
        const fxRate = chosen.currency === "EUR" ? 1 : rates[chosen.currency];

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
      data: { status: "failed", finishedAt: new Date(), cardsUpdated, errors: [String(e), ...errors] },
    });
    throw e;
  }
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/daily-update.ts
git commit -m "feat: add daily price update orchestration (resolve + convert + upsert)"
```

---

## Task 8: Cron route + local script + schedule

**Files:** Create `src/app/api/cron/daily/route.ts`, `scripts/run-daily.ts`, `vercel.json`; modify `package.json`, `.env`/`.env.example`

- [ ] **Step 1: Add cron env**

Append to `.env`:

```
CRON_SECRET="generate-a-long-random-string"
# FREE_API_BASE=...   (set when wiring the free price API)
# FREE_API_KEY=...
# EBAY_SOLD_BASE=...   (set when wiring eBay-sold)
# EBAY_SOLD_KEY=...
```

Append the same keys (as placeholders) to `.env.example`.

- [ ] **Step 2: Cron route (Bearer secret)**

`src/app/api/cron/daily/route.ts`:

```ts
import { NextResponse } from "next/server";
import { runDailyUpdate } from "@/services/daily-update";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runDailyUpdate();
    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) }, { status: 500 });
  }
}
```

- [ ] **Step 3: Local script**

`scripts/run-daily.ts`:

```ts
import "dotenv/config";
import { db } from "../src/lib/db";
import { runDailyUpdate } from "../src/services/daily-update";

runDailyUpdate()
  .then((r) => console.log("Done:", r))
  .catch((e) => console.error(e))
  .finally(() => db.$disconnect());
```

Add to `package.json` `"scripts"`:

```json
"job:daily": "tsx scripts/run-daily.ts"
```

- [ ] **Step 4: Vercel cron schedule**

`vercel.json`:

```json
{
  "crons": [{ "path": "/api/cron/daily", "schedule": "0 4 * * *" }]
}
```

(Vercel automatically sends `Authorization: Bearer $CRON_SECRET` when `CRON_SECRET` is set in the project env.)

- [ ] **Step 5: Run the job locally and verify idempotency**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm run job:daily
npm run job:daily
```

Expected: both runs succeed. With no provider keys set yet, output is `Done: { cardsUpdated: 0, errors: [] }` (graceful — FX rows still upserted). Confirm in Prisma Studio that `FxRate` has today's USD+JPY rows and re-running did not duplicate them:

```bash
npm run db:studio
```

- [ ] **Step 6: Verify the cron route rejects without the secret**

```bash
npm run dev
# in another terminal:
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/cron/daily
curl -s -H "Authorization: Bearer WRONG" http://localhost:3000/api/cron/daily
```

Expected: `401` for both. Stop the server.

- [ ] **Step 7: Commit**

```bash
git add "src/app/api/cron/daily/route.ts" scripts/run-daily.ts vercel.json package.json .env.example
git commit -m "feat: add secret-protected daily cron, local job runner, vercel schedule"
```

---

## Task 9: Final verification

- [ ] **Step 1: Tests, types, lint**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm test
npx tsc --noEmit
npm run lint
```

Expected: all unit tests pass (money, fx, resolver, both mappers); no type errors; lint clean.

---

## Self-Review (completed by author)

- **Spec coverage:** Implements spec §5 (multi-source blend via `PriceProvider` + `resolvePrice` with provenance; daily `PriceSnapshot`; `SaleObservation`s; ECB FX with stored `fxRate`; "keine Daten" when resolver returns null) and §8 Cron (secret-protected, idempotent per day). PriceCharting intentionally absent (multi-user ToS — spec §5).
- **Placeholder scan:** No TBD/TODO. External API shapes are handled by fixture-tested mappers with an explicit "VERIFY against real API" note — a real adapter + verification step, not a placeholder.
- **Type consistency:** `Grade` reused from `src/domain/card.ts`; `PriceSource` from Prisma; `ProviderPrice`/`SaleObs`/`PriceProvider` shared via `src/lib/providers/types.ts`; resolver/orchestrator use the same `resolvePrice`/`convertToEur`/`fetchEcbRates` signatures; Prisma compound keys `cardId_grade_date` and `date_currency` match the `@@unique` definitions; `createMany skipDuplicates` relies on the Task 1 unique.
- **Graceful degradation:** providers no-op without keys, so the pipeline (and charts, once data exists) works incrementally; FX still runs.
