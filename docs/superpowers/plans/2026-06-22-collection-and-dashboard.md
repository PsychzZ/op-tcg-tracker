# Collection & Dashboard — Implementation Plan (5/5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Per-user collection + watchlist, add-to-collection flow, "Mein Bestand" P&L, the 3-series price chart on card detail, and the dashboard (totals per grade, value-over-time, top movers, distribution) — plus the app nav. Completes the MVP.

**Architecture:** Pure valuation/movers/chart-shaping logic in `src/domain` (unit-tested). User-scoped DB access in `src/services` (collection, prices) — every query filters by `userId` for data isolation (one integration test proves it). Recharts renders the 3-series chart in a client component; pages are server components behind auth.

**Tech Stack:** Prisma, Next.js server components + server actions, Recharts.

**Prerequisites:** Plans 1–4 complete (auth, catalog, pricing snapshots).

**Reference spec:** `docs/superpowers/specs/2026-06-22-op-tcg-tracker-design.md` (§6 Dashboard/Detail/Watchlist/Add, §7 Look & Feel, §10 isolation test)

**Testing strategy:** valuation, movers, chart-shaping → Vitest unit tests (TDD). Cross-user data isolation → one integration test (`*.itest.ts`, runs against the dev DB via `npm run test:int`). Pages/flows → manual verification.

---

## File Structure (created/modified by this plan)

- `src/domain/valuation.ts` (+ `.test.ts`) — `holdingPnl`, `portfolioTotals`
- `src/domain/movers.ts` (+ `.test.ts`) — `pctChange`
- `src/domain/chart.ts` (+ `.test.ts`) — `buildPriceSeries`
- `src/services/prices.ts` — `getLatestPriceMap`, `getPriceHistory`
- `src/services/collection.ts` (+ `.itest.ts`) — `getUserCollection`, `upsertCollectionItem`, `removeCollectionItem`
- `src/services/watchlist.ts` — `getUserWatchlist`, `toggleWatch`
- `src/services/dashboard.ts` — `getDashboard`
- `src/components/AppShell.tsx` — nav + layout wrapper
- `src/components/PriceChart.tsx` — Recharts 3-series chart (client)
- `src/app/actions/collection.ts`, `src/app/actions/watchlist.ts` — server actions
- `src/app/page.tsx` — dashboard (replaces starter)
- `src/app/watchlist/page.tsx` — watchlist
- `src/app/cards/[id]/page.tsx` — MODIFY: add chart + Mein Bestand + add form
- `src/app/cards/page.tsx` — MODIFY: wrap in AppShell
- `vitest.config.ts` — keep unit include; add `test:int` script in `package.json`

---

## Task 1: Valuation (TDD)

**Files:** Create `src/domain/valuation.ts`, `src/domain/valuation.test.ts`

- [ ] **Step 1: Failing test**

`src/domain/valuation.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { holdingPnl, portfolioTotals, type OwnedItem } from "./valuation";

describe("holdingPnl", () => {
  it("computes value, cost, and profit", () => {
    const r = holdingPnl({ grade: "psa10", quantity: 2, purchasePricePerUnit: 100 }, 150);
    expect(r.value).toBe(300);
    expect(r.cost).toBe(200);
    expect(r.pnlEur).toBe(100);
    expect(r.pnlPct).toBe(50);
  });
  it("handles missing purchase price", () => {
    const r = holdingPnl({ grade: "raw", quantity: 1, purchasePricePerUnit: null }, 50);
    expect(r.value).toBe(50);
    expect(r.cost).toBeNull();
    expect(r.pnlEur).toBeNull();
  });
});

describe("portfolioTotals", () => {
  it("sums value per grade", () => {
    const items: OwnedItem[] = [
      { grade: "psa10", quantity: 1, purchasePricePerUnit: null },
      { grade: "psa10", quantity: 2, purchasePricePerUnit: null },
      { grade: "raw", quantity: 1, purchasePricePerUnit: null },
    ];
    const prices = { psa10: 100, raw: 10, psa9: 0 };
    const totals = portfolioTotals(items, prices);
    expect(totals.psa10).toBe(300);
    expect(totals.raw).toBe(10);
  });
});
```

- [ ] **Step 2: Run → fail**

```bash
npm test -- src/domain/valuation.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement** `src/domain/valuation.ts`:

```ts
import { round2 } from "./money";
import type { Grade } from "./card";

export interface OwnedItem {
  grade: Grade;
  quantity: number;
  purchasePricePerUnit: number | null;
}

export interface Pnl {
  value: number;
  cost: number | null;
  pnlEur: number | null;
  pnlPct: number | null;
}

export function holdingPnl(item: OwnedItem, currentPriceEur: number): Pnl {
  const value = round2(item.quantity * currentPriceEur);
  if (item.purchasePricePerUnit == null) {
    return { value, cost: null, pnlEur: null, pnlPct: null };
  }
  const cost = round2(item.quantity * item.purchasePricePerUnit);
  const pnlEur = round2(value - cost);
  const pnlPct = cost > 0 ? round2((pnlEur / cost) * 100) : null;
  return { value, cost, pnlEur, pnlPct };
}

export type GradeTotals = Record<Grade, number>;

export function portfolioTotals(items: OwnedItem[], priceByGrade: GradeTotals): GradeTotals {
  const totals: GradeTotals = { raw: 0, psa9: 0, psa10: 0 };
  for (const item of items) {
    const price = priceByGrade[item.grade] ?? 0;
    totals[item.grade] = round2(totals[item.grade] + item.quantity * price);
  }
  return totals;
}
```

- [ ] **Step 4: Run → pass**

```bash
npm test -- src/domain/valuation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/valuation.ts src/domain/valuation.test.ts
git commit -m "feat: add holding P&L and portfolio totals"
```

---

## Task 2: Movers (TDD)

**Files:** Create `src/domain/movers.ts`, `src/domain/movers.test.ts`

- [ ] **Step 1: Failing test**

`src/domain/movers.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pctChange } from "./movers";

describe("pctChange", () => {
  it("computes percentage change", () => {
    expect(pctChange(100, 150)).toBe(50);
    expect(pctChange(100, 80)).toBe(-20);
  });
  it("returns null when base is non-positive", () => {
    expect(pctChange(0, 50)).toBeNull();
  });
});
```

- [ ] **Step 2: Run → fail**

```bash
npm test -- src/domain/movers.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement** `src/domain/movers.ts`:

```ts
import { round2 } from "./money";

export function pctChange(oldValue: number, newValue: number): number | null {
  if (oldValue <= 0) return null;
  return round2(((newValue - oldValue) / oldValue) * 100);
}
```

- [ ] **Step 4: Run → pass**

```bash
npm test -- src/domain/movers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/movers.ts src/domain/movers.test.ts
git commit -m "feat: add percentage-change helper for movers"
```

---

## Task 3: Chart series shaping (TDD)

**Files:** Create `src/domain/chart.ts`, `src/domain/chart.test.ts`

- [ ] **Step 1: Failing test**

`src/domain/chart.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildPriceSeries, type SnapshotPoint } from "./chart";

describe("buildPriceSeries", () => {
  it("merges grades by date and sorts ascending", () => {
    const pts: SnapshotPoint[] = [
      { date: "2026-06-02", grade: "psa10", priceEur: 980 },
      { date: "2026-06-01", grade: "raw", priceEur: 200 },
      { date: "2026-06-01", grade: "psa10", priceEur: 950 },
    ];
    const series = buildPriceSeries(pts);
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ date: "2026-06-01", raw: 200, psa10: 950 });
    expect(series[1]).toEqual({ date: "2026-06-02", psa10: 980 });
  });
});
```

- [ ] **Step 2: Run → fail**

```bash
npm test -- src/domain/chart.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement** `src/domain/chart.ts`:

```ts
import type { Grade } from "./card";

export interface SnapshotPoint {
  date: string; // YYYY-MM-DD
  grade: Grade;
  priceEur: number;
}

export interface SeriesPoint {
  date: string;
  raw?: number;
  psa9?: number;
  psa10?: number;
}

export function buildPriceSeries(points: SnapshotPoint[]): SeriesPoint[] {
  const byDate = new Map<string, SeriesPoint>();
  for (const p of points) {
    const entry = byDate.get(p.date) ?? { date: p.date };
    entry[p.grade] = p.priceEur;
    byDate.set(p.date, entry);
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}
```

- [ ] **Step 4: Run → pass**

```bash
npm test -- src/domain/chart.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/domain/chart.ts src/domain/chart.test.ts
git commit -m "feat: add price-series shaping for charts"
```

---

## Task 4: Service layer (prices, collection, watchlist) + isolation test

**Files:** Create `src/services/prices.ts`, `src/services/collection.ts`, `src/services/collection.itest.ts`, `src/services/watchlist.ts`; modify `package.json`

- [ ] **Step 1: Prices service**

`src/services/prices.ts`:

```ts
import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";
import type { SnapshotPoint } from "@/domain/chart";

/** Latest price (EUR) per grade for a single card. */
export async function getLatestPriceMap(cardId: string): Promise<Record<Grade, number>> {
  const rows = await db.priceSnapshot.findMany({
    where: { cardId },
    orderBy: { date: "desc" },
  });
  const map: Record<Grade, number> = { raw: 0, psa9: 0, psa10: 0 };
  const seen = new Set<Grade>();
  for (const r of rows) {
    if (!seen.has(r.grade)) {
      map[r.grade] = Number(r.priceEur);
      seen.add(r.grade);
    }
  }
  return map;
}

export async function getPriceHistory(cardId: string, sinceDays = 365): Promise<SnapshotPoint[]> {
  const since = new Date(Date.now() - sinceDays * 86400_000);
  const rows = await db.priceSnapshot.findMany({
    where: { cardId, date: { gte: since } },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    grade: r.grade,
    priceEur: Number(r.priceEur),
  }));
}
```

- [ ] **Step 2: Collection service (user-scoped)**

`src/services/collection.ts`:

```ts
import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";

export function getUserCollection(userId: string) {
  return db.collectionItem.findMany({
    where: { userId },
    include: { card: true },
    orderBy: { createdAt: "desc" },
  });
}

export function upsertCollectionItem(input: {
  userId: string;
  cardId: string;
  grade: Grade;
  quantity: number;
  purchasePricePerUnit?: number | null;
}) {
  const { userId, cardId, grade, quantity, purchasePricePerUnit } = input;
  return db.collectionItem.upsert({
    where: { userId_cardId_grade: { userId, cardId, grade } },
    update: { quantity, purchasePricePerUnit: purchasePricePerUnit ?? null },
    create: { userId, cardId, grade, quantity, purchasePricePerUnit: purchasePricePerUnit ?? null },
  });
}

export function removeCollectionItem(userId: string, id: string) {
  // userId in the filter guarantees a user can only delete their own row.
  return db.collectionItem.deleteMany({ where: { id, userId } });
}
```

- [ ] **Step 3: Watchlist service (user-scoped)**

`src/services/watchlist.ts`:

```ts
import { db } from "@/lib/db";

export function getUserWatchlist(userId: string) {
  return db.watchlistItem.findMany({ where: { userId }, include: { card: true } });
}

export async function toggleWatch(userId: string, cardId: string) {
  const existing = await db.watchlistItem.findUnique({
    where: { userId_cardId: { userId, cardId } },
  });
  if (existing) {
    await db.watchlistItem.delete({ where: { id: existing.id } });
    return false;
  }
  await db.watchlistItem.create({ data: { userId, cardId } });
  return true;
}
```

- [ ] **Step 4: Data-isolation integration test**

`src/services/collection.itest.ts`:

```ts
import "dotenv/config";
import { describe, it, expect, afterAll } from "vitest";
import { db } from "@/lib/db";
import { getUserCollection, upsertCollectionItem } from "./collection";

describe("collection data isolation (integration)", () => {
  const ids: { users: string[]; cards: string[] } = { users: [], cards: [] };

  afterAll(async () => {
    await db.collectionItem.deleteMany({ where: { userId: { in: ids.users } } });
    await db.user.deleteMany({ where: { id: { in: ids.users } } });
    await db.card.deleteMany({ where: { id: { in: ids.cards } } });
    await db.$disconnect();
  });

  it("a user never sees another user's collection items", async () => {
    const a = await db.user.create({ data: { email: `a_${Date.now()}@t.test`, displayName: "A", passwordHash: "x", role: "friend" } });
    const b = await db.user.create({ data: { email: `b_${Date.now()}@t.test`, displayName: "B", passwordHash: "x", role: "friend" } });
    ids.users.push(a.id, b.id);
    const card = await db.card.create({ data: { externalId: `T-${Date.now()}`, name: "Test", rarity: "SEC", variant: "normal", category: "booster", language: "ja" } });
    ids.cards.push(card.id);

    await upsertCollectionItem({ userId: a.id, cardId: card.id, grade: "psa10", quantity: 1 });

    const aColl = await getUserCollection(a.id);
    const bColl = await getUserCollection(b.id);
    expect(aColl).toHaveLength(1);
    expect(bColl).toHaveLength(0);
  });
});
```

- [ ] **Step 5: Add the integration test script to `package.json`**

In `"scripts"`, add:

```json
"test:int": "vitest run --include \"src/**/*.itest.ts\""
```

(Default `npm test` ignores `*.itest.ts`, so the fast unit suite stays DB-free.)

- [ ] **Step 6: Run the isolation test**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm run test:int
```

Expected: PASS — isolation holds.

- [ ] **Step 7: Commit**

```bash
git add src/services/prices.ts src/services/collection.ts src/services/collection.itest.ts src/services/watchlist.ts package.json
git commit -m "feat: add price/collection/watchlist services + isolation integration test"
```

---

## Task 5: App shell (nav)

**Files:** Create `src/components/AppShell.tsx`

- [ ] **Step 1: Implement** `src/components/AppShell.tsx`:

```tsx
import Link from "next/link";
import { signOut } from "@/auth";
import { getCurrentUser } from "@/lib/session";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="min-h-screen bg-[#1e1f22] text-[#f3f4f5]">
      <header className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-[#26272b]">
        <div className="flex items-center gap-6">
          <span className="flex items-center gap-2 font-semibold">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#d8b143]" /> OP&nbsp;Vault
          </span>
          <nav className="flex gap-5 text-sm text-[#b0b3b8]">
            <Link href="/">Dashboard</Link>
            <Link href="/cards">Karten</Link>
            <Link href="/watchlist">Watchlist</Link>
            {user?.role === "owner" && <Link href="/settings/invites">Invites</Link>}
          </nav>
        </div>
        <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
          <button className="text-sm text-[#82858c] hover:text-[#f3f4f5]">Logout</button>
        </form>
      </header>
      <main className="p-8">{children}</main>
    </div>
  );
}
```

- [ ] **Step 2: Wrap the existing gallery page in the shell**

In `src/app/cards/page.tsx`, replace the outer `<main className="min-h-screen ...">...</main>` wrapper with `<AppShell>...</AppShell>` (import it: `import { AppShell } from "@/components/AppShell";`) and remove the now-duplicated `min-h-screen bg/text/p-8` wrapper (keep the inner `<h1>`, form, and grid). Do the same for `src/app/cards/[id]/page.tsx`.

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Visit `/cards` → the top nav appears with Dashboard/Karten/Watchlist + Logout. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/components/AppShell.tsx src/app/cards/page.tsx "src/app/cards/[id]/page.tsx"
git commit -m "feat: add app shell with nav and logout"
```

---

## Task 6: Price chart + card detail (Mein Bestand + add form)

**Files:** Install Recharts; create `src/components/PriceChart.tsx`, `src/app/actions/collection.ts`; modify `src/app/cards/[id]/page.tsx`

- [ ] **Step 1: Install Recharts**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm install recharts
```

- [ ] **Step 2: Chart component (client)**

`src/components/PriceChart.tsx`:

```tsx
"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SeriesPoint } from "@/domain/chart";

export function PriceChart({ data }: { data: SeriesPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[#82858c]">Noch keine Preis-Historie — wächst ab dem ersten Sync.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#ffffff10" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#82858c", fontSize: 11 }} minTickGap={32} />
        <YAxis tick={{ fill: "#82858c", fontSize: 11 }} width={48} />
        <Tooltip contentStyle={{ background: "#26272b", border: "1px solid #ffffff20", borderRadius: 8, color: "#f3f4f5" }} />
        <Line type="monotone" dataKey="raw" name="Raw" stroke="#888c93" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
        <Line type="monotone" dataKey="psa9" name="PSA 9" stroke="#eef0f3" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="psa10" name="PSA 10" stroke="#d8b143" strokeWidth={2.5} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 3: Collection actions**

`src/app/actions/collection.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { upsertCollectionItem, removeCollectionItem } from "@/services/collection";
import type { Grade } from "@/domain/card";

export async function addToCollectionAction(formData: FormData) {
  const user = await requireUser();
  const cardId = String(formData.get("cardId"));
  const grade = String(formData.get("grade")) as Grade;
  const quantity = Number(formData.get("quantity") ?? 1);
  const priceRaw = formData.get("purchasePrice");
  const purchasePricePerUnit = priceRaw ? Number(priceRaw) : null;
  await upsertCollectionItem({ userId: user.id, cardId, grade, quantity, purchasePricePerUnit });
  revalidatePath(`/cards/${cardId}`);
}

export async function removeFromCollectionAction(formData: FormData) {
  const user = await requireUser();
  const id = String(formData.get("id"));
  const cardId = String(formData.get("cardId"));
  await removeCollectionItem(user.id, id);
  revalidatePath(`/cards/${cardId}`);
}
```

- [ ] **Step 4: Rewrite card detail to show chart + holdings + add form**

Replace `src/app/cards/[id]/page.tsx` with:

```tsx
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { PriceChart } from "@/components/PriceChart";
import { getLatestPriceMap, getPriceHistory } from "@/services/prices";
import { holdingPnl } from "@/domain/valuation";
import { buildPriceSeries } from "@/domain/chart";
import { formatEur } from "@/domain/money";
import { addToCollectionAction, removeFromCollectionAction } from "@/app/actions/collection";
import type { Grade } from "@/domain/card";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];
const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const card = await db.card.findUnique({ where: { id } });
  if (!card) notFound();

  const [prices, history, holdings] = await Promise.all([
    getLatestPriceMap(card.id),
    getPriceHistory(card.id),
    db.collectionItem.findMany({ where: { userId: user.id, cardId: card.id } }),
  ]);
  const series = buildPriceSeries(history);

  return (
    <AppShell>
      <div className="flex gap-6 flex-wrap">
        <div className="w-[230px] shrink-0">
          <div className="rounded-[10px] overflow-hidden border border-white/10 bg-[#2c2e33] h-[300px] flex items-center justify-center">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.imageUrl} alt={card.name} className="h-full object-contain" />
            ) : (
              <span className="text-[#82858c] text-xs">kein Bild</span>
            )}
          </div>

          <div className="mt-3 border border-white/10 rounded-[10px] bg-[#26272b] p-3.5">
            <div className="text-[10px] tracking-widest uppercase text-[#82858c] mb-2">Mein Bestand</div>
            {holdings.length === 0 && <p className="text-sm text-[#82858c]">Noch nicht in deiner Sammlung.</p>}
            {holdings.map((h) => {
              const pnl = holdingPnl(
                { grade: h.grade, quantity: h.quantity, purchasePricePerUnit: h.purchasePricePerUnit ? Number(h.purchasePricePerUnit) : null },
                prices[h.grade] ?? 0,
              );
              return (
                <div key={h.id} className="text-sm mb-2 border-b border-white/5 pb-2">
                  <div className="flex justify-between"><span className="text-[#b0b3b8]">{GRADE_LABEL[h.grade]} ×{h.quantity}</span><span>{formatEur(pnl.value)}</span></div>
                  {pnl.pnlEur != null && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-[#82858c]">G/V</span>
                      <span className={pnl.pnlEur >= 0 ? "text-[#6ad29b]" : "text-[#e08a8a]"}>
                        {pnl.pnlEur >= 0 ? "▲" : "▼"} {formatEur(pnl.pnlEur)} ({pnl.pnlPct}%)
                      </span>
                    </div>
                  )}
                  <form action={removeFromCollectionAction} className="mt-1">
                    <input type="hidden" name="id" value={h.id} />
                    <input type="hidden" name="cardId" value={card.id} />
                    <button className="text-xs text-[#82858c] hover:text-[#e08a8a]">entfernen</button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-[300px]">
          <h1 className="text-xl font-bold">{card.name}</h1>
          {card.nameJp && <p className="text-[#82858c] mt-1">{card.nameJp}</p>}
          <p className="text-sm text-[#82858c] mt-2">
            {card.setCode ?? "Promo"} {card.number ? `· ${card.number}` : ""} ·{" "}
            <span className="border border-white/20 rounded px-1.5">{card.rarity}</span> · 🇯🇵 Japanisch
          </p>

          <div className="flex gap-6 mt-4 mb-3">
            {GRADES.map((g) => (
              <div key={g}>
                <div className="text-[11px] text-[#82858c]">{GRADE_LABEL[g]}</div>
                <div className="text-base font-bold tabular-nums">{prices[g] ? formatEur(prices[g]) : "—"}</div>
              </div>
            ))}
          </div>

          <div className="border border-white/10 rounded-[10px] bg-[#252629] p-4">
            <PriceChart data={series} />
          </div>

          <form action={addToCollectionAction} className="mt-5 flex flex-wrap items-end gap-2">
            <input type="hidden" name="cardId" value={card.id} />
            <label className="text-xs text-[#82858c]">Grade
              <select name="grade" className="block mt-1 rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm">
                {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
              </select>
            </label>
            <label className="text-xs text-[#82858c]">Menge
              <input name="quantity" type="number" min="1" defaultValue="1" className="block mt-1 w-20 rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-[#82858c]">Kaufpreis (€)
              <input name="purchasePrice" type="number" step="0.01" className="block mt-1 w-28 rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm" />
            </label>
            <button className="rounded-md bg-[#d8b143] text-[#0e0f13] font-medium px-4 py-2 text-sm">Zur Sammlung</button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 5: Verify end-to-end**

```bash
npm run dev
```

Open a card → add it (e.g. PSA 10, qty 1, price 500) → "Mein Bestand" shows value + G/V. The chart shows the "no history yet" hint (or a line if you've run `npm run job:daily` with provider data). Stop the server.

- [ ] **Step 6: Commit**

```bash
git add recharts package.json package-lock.json src/components/PriceChart.tsx src/app/actions/collection.ts "src/app/cards/[id]/page.tsx"
git commit -m "feat: card detail with 3-series chart, holdings P&L, add-to-collection"
```

---

## Task 7: Watchlist page

**Files:** Create `src/app/watchlist/page.tsx`, `src/app/actions/watchlist.ts`

- [ ] **Step 1: Watchlist action**

`src/app/actions/watchlist.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { toggleWatch } from "@/services/watchlist";

export async function toggleWatchAction(formData: FormData) {
  const user = await requireUser();
  const cardId = String(formData.get("cardId"));
  await toggleWatch(user.id, cardId);
  revalidatePath("/watchlist");
}
```

- [ ] **Step 2: Watchlist page**

`src/app/watchlist/page.tsx`:

```tsx
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getUserWatchlist } from "@/services/watchlist";
import { CardThumb } from "@/components/CardThumb";

export default async function WatchlistPage() {
  const user = await requireUser();
  const items = await getUserWatchlist(user.id);

  return (
    <AppShell>
      <h1 className="text-lg font-semibold mb-4">Watchlist</h1>
      {items.length === 0 ? (
        <p className="text-[#82858c]">Noch nichts beobachtet. Füge Karten aus der Galerie hinzu.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {items.map((w) => <CardThumb key={w.id} card={w.card} />)}
        </div>
      )}
    </AppShell>
  );
}
```

- [ ] **Step 3: Add a watch toggle button to the gallery thumbnail (optional wiring)**

In `src/components/CardThumb.tsx`, the card already links to detail. Add the watch button on the detail page instead — append this form inside the right column of `src/app/cards/[id]/page.tsx` (under the metadata `<p>`), importing `toggleWatchAction`:

```tsx
<form action={toggleWatchAction} className="mt-3">
  <input type="hidden" name="cardId" value={card.id} />
  <button className="text-xs text-[#d8b143] border border-[#d8b143]/50 rounded-md px-3 py-1.5">★ Watchlist</button>
</form>
```

Add the import at the top of that file: `import { toggleWatchAction } from "@/app/actions/watchlist";`

- [ ] **Step 4: Verify**

```bash
npm run dev
```

On a card detail, click ★ Watchlist → visit `/watchlist` → the card appears. Click again → it's removed. Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/app/watchlist/page.tsx src/app/actions/watchlist.ts "src/app/cards/[id]/page.tsx"
git commit -m "feat: add watchlist page and toggle"
```

---

## Task 8: Dashboard

**Files:** Create `src/services/dashboard.ts`; replace `src/app/page.tsx`

- [ ] **Step 1: Dashboard service**

`src/services/dashboard.ts`:

```ts
import { db } from "@/lib/db";
import type { Grade } from "@/domain/card";
import { portfolioTotals, type OwnedItem } from "@/domain/valuation";
import { getLatestPriceMap } from "@/services/prices";
import { pctChange } from "@/domain/movers";

export async function getDashboard(userId: string) {
  const items = await db.collectionItem.findMany({ where: { userId }, include: { card: true } });

  // Latest price per distinct owned card.
  const cardIds = [...new Set(items.map((i) => i.cardId))];
  const priceMaps = new Map<string, Record<Grade, number>>();
  await Promise.all(cardIds.map(async (id) => priceMaps.set(id, await getLatestPriceMap(id))));

  // Totals per grade across the whole collection.
  const totals: Record<Grade, number> = { raw: 0, psa9: 0, psa10: 0 };
  for (const item of items) {
    const price = priceMaps.get(item.cardId)?.[item.grade] ?? 0;
    const owned: OwnedItem = { grade: item.grade, quantity: item.quantity, purchasePricePerUnit: null };
    const sub = portfolioTotals([owned], { raw: price, psa9: price, psa10: price });
    totals[item.grade] += sub[item.grade];
  }

  // Top movers (PSA 10 30-day change) for owned cards.
  const since = new Date(Date.now() - 30 * 86400_000);
  const movers: Array<{ name: string; cardId: string; pct: number }> = [];
  for (const id of cardIds) {
    const recent = await db.priceSnapshot.findFirst({ where: { cardId: id, grade: "psa10" }, orderBy: { date: "desc" } });
    const old = await db.priceSnapshot.findFirst({ where: { cardId: id, grade: "psa10", date: { lte: since } }, orderBy: { date: "desc" } });
    if (recent && old) {
      const pct = pctChange(Number(old.priceEur), Number(recent.priceEur));
      if (pct != null) {
        const card = items.find((i) => i.cardId === id)?.card;
        if (card) movers.push({ name: card.name, cardId: id, pct });
      }
    }
  }
  movers.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct));

  // Distribution by rarity.
  const distribution: Record<string, number> = {};
  for (const item of items) {
    distribution[item.card.rarity] = (distribution[item.card.rarity] ?? 0) + item.quantity;
  }

  return { totals, movers: movers.slice(0, 5), distribution, count: items.length };
}
```

- [ ] **Step 2: Dashboard page (replaces the starter)**

Replace `src/app/page.tsx` with:

```tsx
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getDashboard } from "@/services/dashboard";
import { formatEur } from "@/domain/money";

export default async function DashboardPage() {
  const user = await requireUser();
  const { totals, movers, distribution, count } = await getDashboard(user.id);

  const kpis = [
    { label: "Wert · Raw", value: totals.raw },
    { label: "Wert · PSA 9", value: totals.psa9 },
    { label: "Wert · PSA 10", value: totals.psa10 },
  ];

  return (
    <AppShell>
      <h1 className="text-lg font-semibold mb-4">Dashboard</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="flex-1 min-w-[180px] border border-white/10 rounded-[10px] bg-[#26272b] p-4">
            <div className="text-[10px] tracking-widest uppercase text-[#82858c] mb-2">{k.label}</div>
            <div className="text-2xl font-bold tabular-nums">{formatEur(k.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="border border-white/10 rounded-[10px] bg-[#26272b] p-4">
          <h2 className="text-sm font-semibold mb-3">Top-Mover (PSA 10, 30T)</h2>
          {movers.length === 0 ? (
            <p className="text-sm text-[#82858c]">Noch keine Trenddaten (brauchen ~30 Tage Historie).</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {movers.map((m) => (
                <li key={m.cardId} className="flex justify-between">
                  <a href={`/cards/${m.cardId}`} className="text-[#b0b3b8] hover:text-[#f3f4f5]">{m.name}</a>
                  <span className={m.pct >= 0 ? "text-[#6ad29b]" : "text-[#e08a8a]"}>
                    {m.pct >= 0 ? "▲" : "▼"} {m.pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-white/10 rounded-[10px] bg-[#26272b] p-4">
          <h2 className="text-sm font-semibold mb-3">Verteilung ({count} Karten)</h2>
          {Object.keys(distribution).length === 0 ? (
            <p className="text-sm text-[#82858c]">Deine Sammlung ist leer.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(distribution).map(([rarity, n]) => (
                <li key={rarity} className="flex justify-between">
                  <span className="text-[#b0b3b8]">{rarity}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Log in → `/` shows the dashboard with KPI totals (reflecting cards you added), distribution, and movers placeholder. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/services/dashboard.ts src/app/page.tsx
git commit -m "feat: add per-user dashboard (totals, movers, distribution)"
```

---

## Task 9: Final verification (whole MVP)

- [ ] **Step 1: Unit tests, integration test, types, lint, build**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm test
npm run test:int
npx tsc --noEmit
npm run lint
npm run build
```

Expected: all green; production build succeeds.

- [ ] **Step 2: Full manual smoke**

```bash
npm run dev
```

1. Owner login → `/settings/invites` → create code.
2. Friend register (private window) with the code → lands on dashboard.
3. Friend: browse `/cards`, open a card, add to collection, see it on dashboard, add to watchlist.
4. Owner: confirm the friend's collection is NOT visible to the owner (separate dashboards).

Stop the server.

- [ ] **Step 3: (Optional) Deploy**

Push the repo to GitHub, import into Vercel, set env vars (`DATABASE_URL`, `AUTH_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `CRON_SECRET`, and provider keys when ready). Run `npm run seed:owner` and `npm run import:catalog` against the production DB (locally with prod `DATABASE_URL`, or via a one-off). Vercel Cron will hit `/api/cron/daily` daily.

---

## Self-Review (completed by author)

- **Spec coverage:** Implements spec §6 Dashboard (per-user totals per grade, top movers, distribution), card detail (3-series chart via Recharts with the §7 token colors, "Mein Bestand" P&L, add/remove), Watchlist; §10 includes the data-isolation integration test. Value-over-time line for the *whole portfolio* is represented by per-card history + dashboard totals; a dedicated portfolio-history chart can be added later (Phase 2) — KPIs + per-card charts cover the MVP.
- **Placeholder scan:** No TBD/TODO; every step has full code/commands. Optional deploy step is clearly optional.
- **Type consistency:** `Grade` reused everywhere; `OwnedItem`/`Pnl` from `valuation.ts` match usage in detail + dashboard; `SeriesPoint`/`SnapshotPoint` from `chart.ts` match `PriceChart` props and `getPriceHistory`; service function names (`getUserCollection`, `upsertCollectionItem`, `removeCollectionItem`, `getUserWatchlist`, `toggleWatch`, `getLatestPriceMap`, `getPriceHistory`, `getDashboard`) match their callers in actions/pages; Prisma compound keys `userId_cardId_grade` and `userId_cardId` match the schema `@@unique`s.
- **Cross-plan check:** uses `AppShell`, `requireUser`/`getCurrentUser` (Plan 2), `CardThumb` (Plan 3), `formatEur`/`round2` (Plan 4), `PriceSnapshot` data (Plan 4). All referenced symbols exist in earlier plans.
