# UI Refinement + Local Postgres (Pi) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Vault UI (card-detail hero, cross-page consistency + a11y, dashboard/gallery refinements) and add a documented local-Postgres setup so the app can self-host on a Raspberry Pi.

**Architecture:** Next 16 App Router (server components + server actions), Tailwind v4 tokens in `globals.css`, lightweight `src/components/ui/*`. Pure logic lives in `src/domain/*` and is unit-tested with Vitest; the repo has **no React component-test harness**, so UI tasks are verified with `tsc --noEmit`, `vitest run` (existing suite), and `next build`. DB stays Postgres (Prisma migrations); the Pi runs Postgres in Docker Compose.

**Tech Stack:** Next.js 16.2.9, React 19, TypeScript, Tailwind v4, Prisma 6 (postgresql), Recharts, Vitest 2, Docker Compose (postgres:16-alpine).

**Verification baseline (run before starting, must be green):**
- `npx tsc --noEmit`
- `npx vitest run` → 88 passed
- `npm run build`

---

## Phase A — Card-detail elevation

### Task A1: `gradeDeltas` helper

**Files:**
- Modify: `src/domain/movers.ts`
- Test: `src/domain/movers.test.ts`

- [ ] **Step 1: Write the failing test** — append to `src/domain/movers.test.ts`:

```ts
import { gradeDeltas } from "./movers";
import type { SnapshotPoint } from "./chart";

describe("gradeDeltas", () => {
  const hist: SnapshotPoint[] = [
    { date: "2026-05-01", grade: "raw", priceEur: 100 },
    { date: "2026-06-01", grade: "raw", priceEur: 120 },
    { date: "2026-05-01", grade: "psa10", priceEur: 200 },
  ];

  it("computes percent change per grade over the window, from the latest date", () => {
    const d = gradeDeltas(hist, 60); // cutoff = 2026-04-02 → ref = 2026-05-01 (100) vs 120
    expect(d.raw).toBe(20);
  });

  it("uses the earliest point when all points fall inside the window", () => {
    const d = gradeDeltas(hist, 365);
    expect(d.raw).toBe(20);
  });

  it("returns null for grades with fewer than two points", () => {
    const d = gradeDeltas(hist, 30);
    expect(d.psa10).toBeNull();
    expect(d.psa9).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/domain/movers.test.ts`
Expected: FAIL — `gradeDeltas is not a function`.

- [ ] **Step 3: Implement** — replace the contents of `src/domain/movers.ts` with:

```ts
import { round2 } from "./money";
import type { Grade } from "./card";
import type { SnapshotPoint } from "./chart";

export function pctChange(oldValue: number, newValue: number): number | null {
  if (oldValue <= 0) return null;
  return round2(((newValue - oldValue) / oldValue) * 100);
}

const GRADES: Grade[] = ["raw", "psa9", "psa10"];

/** Percent change per grade over the last `days`, measured back from the latest snapshot date. */
export function gradeDeltas(history: SnapshotPoint[], days: number): Record<Grade, number | null> {
  const out: Record<Grade, number | null> = { raw: null, psa9: null, psa10: null };
  for (const grade of GRADES) {
    const pts = history.filter((p) => p.grade === grade).sort((a, b) => a.date.localeCompare(b.date));
    if (pts.length < 2) continue;
    const latest = pts[pts.length - 1];
    const cutoff = new Date(latest.date);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffIso = cutoff.toISOString().slice(0, 10);
    const older = [...pts].reverse().find((p) => p.date <= cutoffIso);
    const ref = older ?? pts[0];
    if (ref.date === latest.date) continue;
    out[grade] = pctChange(ref.priceEur, latest.priceEur);
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/domain/movers.test.ts`
Expected: PASS (all gradeDeltas + existing pctChange tests).

- [ ] **Step 5: Commit**

```bash
git add src/domain/movers.ts src/domain/movers.test.ts
git commit -m "feat: gradeDeltas helper for per-grade price change"
```

---

### Task A2: Price-history range toggle (client wrapper)

**Files:**
- Create: `src/components/PriceHistory.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState } from "react";
import { PriceChart } from "./PriceChart";
import type { SeriesPoint } from "@/domain/chart";
import { cn } from "@/lib/cn";

const RANGES = [
  { d: 30, l: "30T" },
  { d: 90, l: "90T" },
  { d: 365, l: "1J" },
  { d: 0, l: "Alle" },
];

export function PriceHistory({ data }: { data: SeriesPoint[] }) {
  const [days, setDays] = useState(90);

  let filtered = data;
  if (days > 0 && data.length > 0) {
    const last = new Date(data[data.length - 1].date);
    last.setDate(last.getDate() - days);
    const cutoff = last.toISOString().slice(0, 10);
    filtered = data.filter((p) => p.date >= cutoff);
  }

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.d}
            type="button"
            onClick={() => setDays(r.d)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              days === r.d ? "bg-raised text-ink" : "text-dim hover:text-ink",
            )}
          >
            {r.l}
          </button>
        ))}
      </div>
      <PriceChart data={filtered} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PriceHistory.tsx
git commit -m "feat: price-history range toggle component"
```

---

### Task A3: Elevate the card-detail page

**Files:**
- Modify: `src/app/cards/[id]/page.tsx`

- [ ] **Step 1: Update imports** — in `src/app/cards/[id]/page.tsx`, change the import block so it includes `gradeDeltas`, `PriceHistory`, and `Badge`, and drop the now-unused `PriceChart`:

```tsx
import { PriceHistory } from "@/components/PriceHistory";
import { Badge, RarityBadge } from "@/components/ui/Badge";
import { getLatestPriceMap, getPriceHistory } from "@/services/prices";
import { gradeDeltas } from "@/domain/movers";
```

Remove the line `import { PriceChart } from "@/components/PriceChart";`.

- [ ] **Step 2: Add variant labels + fetch watched state + compute deltas** — below the existing `GRADE_VALUE_CLS` constant add:

```tsx
const VARIANT_LABEL: Record<string, string> = {
  altArt: "Alt Art",
  mangaArt: "Manga",
  parallel: "Parallel",
  serial: "Serial",
};
```

Change the `Promise.all` to also fetch the watch row, and compute deltas after:

```tsx
  const [prices, history, holdings, watched] = await Promise.all([
    getLatestPriceMap(card.id),
    getPriceHistory(card.id),
    db.collectionItem.findMany({ where: { userId: user.id, cardId: card.id } }),
    db.watchlistItem.findFirst({ where: { userId: user.id, cardId: card.id } }),
  ]);
  const series = buildPriceSeries(history);
  const deltas = gradeDeltas(history, 30);
```

- [ ] **Step 3: Make the image column sticky** — change the LEFT column wrapper:

```tsx
        {/* LEFT: image + holdings */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
```

- [ ] **Step 4: Replace the header meta + watchlist button** — replace the `flex items-center gap-2 ... mt-2.5` meta row and the watchlist `<form>` with:

```tsx
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted mt-2.5">
                <span>
                  {card.setCode ?? "Promo"}
                  {card.number ? ` · ${card.number}` : ""}
                </span>
                <RarityBadge rarity={card.rarity} />
                {VARIANT_LABEL[card.variant] && <Badge className="border-line-strong text-muted">{VARIANT_LABEL[card.variant]}</Badge>}
                <Badge className="border-line-strong text-dim">JP</Badge>
              </div>
            </div>
            <form action={toggleWatchAction}>
              <input type="hidden" name="cardId" value={card.id} />
              <Button variant={watched ? "primary" : "outline"} size="sm" className="whitespace-nowrap">
                {watched ? "★ Beobachtet" : "☆ Watchlist"}
              </Button>
            </form>
```

- [ ] **Step 5: Add the 30-day delta to each grade tile** — replace the grade-tile `Panel` body with:

```tsx
              <Panel key={g} className="px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-dim">
                  <span className="w-2 h-2 rounded-full" style={{ background: `var(--color-${g})` }} />
                  {GRADE_LABEL[g]}
                </div>
                <div className={cn("text-xl font-bold tabular-nums mt-1.5", GRADE_VALUE_CLS[g])}>
                  {prices[g] ? formatEur(prices[g]) : "—"}
                </div>
                {deltas[g] !== null && (
                  <div className={cn("text-[11px] tabular-nums mt-0.5", deltas[g]! >= 0 ? "text-up" : "text-down")}>
                    {deltas[g]! >= 0 ? "▲" : "▼"} {Math.abs(deltas[g]!)}% · 30T
                  </div>
                )}
              </Panel>
```

- [ ] **Step 6: Swap the chart for the range-toggle version** — in the "Preisverlauf" panel replace `<PriceChart data={series} />` with `<PriceHistory data={series} />`.

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: both succeed; `/cards/[id]` compiles.

- [ ] **Step 8: Commit**

```bash
git add src/app/cards/[id]/page.tsx
git commit -m "feat: elevate card-detail (sticky image, deltas, range toggle, watch state)"
```

**CHECKPOINT — user reviews the card-detail page live before Phase B.**

---

## Phase B — Consistency & accessibility

### Task B1: SVG icon set

**Files:**
- Create: `src/components/ui/icons.tsx`

- [ ] **Step 1: Create the file**

```tsx
import { cn } from "@/lib/cn";

type IconProps = { className?: string };

function Svg({ className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", className)}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const StarIcon = (p: IconProps) => (
  <Svg {...p}>
    <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" />
  </Svg>
);
export const StarFilledIcon = (p: IconProps) => (
  <Svg {...p}>
    <polygon points="12 2 15 9 22 9.5 17 14.5 18.5 22 12 18 5.5 22 7 14.5 2 9.5 9 9" fill="currentColor" />
  </Svg>
);
export const SearchIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </Svg>
);
export const ChevronLeftIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="m15 18-6-6 6-6" />
  </Svg>
);
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </Svg>
);
```

- [ ] **Step 2: Verify** — `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/icons.tsx
git commit -m "feat: inline SVG icon set"
```

---

### Task B2: PageHeader + EmptyState components

**Files:**
- Create: `src/components/ui/PageHeader.tsx`
- Create: `src/components/ui/EmptyState.tsx`

- [ ] **Step 1: Create `PageHeader.tsx`**

```tsx
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Create `EmptyState.tsx`**

```tsx
import { Panel } from "./Panel";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <Panel className="p-10 text-center">
      {icon && <div className="mx-auto mb-3 grid place-items-center w-10 h-10 rounded-full bg-raised text-dim">{icon}</div>}
      <p className="text-ink font-medium">{title}</p>
      {description && <p className="text-sm text-muted mt-1">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </Panel>
  );
}
```

- [ ] **Step 3: Verify** — `npx tsc --noEmit` → no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/PageHeader.tsx src/components/ui/EmptyState.tsx
git commit -m "feat: PageHeader and EmptyState components"
```

---

### Task B3: Apply PageHeader / EmptyState / icons across pages

**Files:**
- Modify: `src/components/CardThumb.tsx`
- Modify: `src/app/watchlist/page.tsx`
- Modify: `src/app/settings/invites/page.tsx`
- Modify: `src/app/cards/page.tsx`

- [ ] **Step 1: CardThumb star → SVG icon** — in `src/components/CardThumb.tsx` add `import { StarIcon, StarFilledIcon } from "./ui/icons";` and replace the `★` button glyph with the icons:

```tsx
        <button
          title={watched ? "Von Watchlist entfernen" : "Zur Watchlist"}
          aria-label={watched ? "Von Watchlist entfernen" : "Zur Watchlist"}
          className={`h-7 w-7 rounded-md grid place-items-center transition
            ${
              watched
                ? "bg-gold text-vault"
                : "bg-black/55 text-ink opacity-0 group-hover:opacity-100 hover:bg-black/75 backdrop-blur-sm"
            }`}
        >
          {watched ? <StarFilledIcon className="h-3.5 w-3.5" /> : <StarIcon className="h-3.5 w-3.5" />}
        </button>
```

- [ ] **Step 2: Watchlist page** — replace its body with PageHeader + EmptyState:

```tsx
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getUserWatchlist } from "@/services/watchlist";
import { getLatestRawPrices } from "@/services/prices";
import { CardThumb } from "@/components/CardThumb";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarIcon } from "@/components/ui/icons";

export default async function WatchlistPage() {
  const user = await requireUser();
  const items = await getUserWatchlist(user.id);
  const prices = await getLatestRawPrices(items.map((w) => w.card.id));

  return (
    <AppShell>
      <PageHeader title="Watchlist" subtitle="Karten, die du im Blick behältst" />
      {items.length === 0 ? (
        <EmptyState
          icon={<StarIcon />}
          title="Noch nichts beobachtet"
          description="Füge Karten aus der Galerie hinzu (Stern auf einer Karte)."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((w) => (
            <CardThumb key={w.id} card={w.card} priceEur={prices.get(w.card.id)} watched />
          ))}
        </div>
      )}
    </AppShell>
  );
}
```

- [ ] **Step 3: Invites page header** — in `src/app/settings/invites/page.tsx` add `import { PageHeader } from "@/components/ui/PageHeader";` and replace the `<h1>` + `<p>` pair with:

```tsx
      <PageHeader title="Invite-Codes" subtitle="Erstelle Codes, mit denen Freunde sich registrieren können." />
```

- [ ] **Step 4: Cards page — back link icon + headers** — in `src/app/cards/page.tsx`:
  - Add `import { ChevronLeftIcon } from "@/components/ui/icons";`.
  - In the browse view, replace the `← Sets` link text with `<span className="inline-flex items-center gap-1"><ChevronLeftIcon className="h-3.5 w-3.5" /> Sets</span>`.
  - Leave the landing's own heading as-is (it has a custom subtitle + search bar layout).

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/components/CardThumb.tsx src/app/watchlist/page.tsx src/app/settings/invites/page.tsx src/app/cards/page.tsx
git commit -m "refactor: apply PageHeader/EmptyState/SVG icons across pages"
```

---

### Task B4: Auth pages — labels, password toggle, error

**Files:**
- Create: `src/components/ui/PasswordInput.tsx`
- Modify: `src/app/(auth)/login/page.tsx`
- Modify: `src/app/(auth)/register/page.tsx`

- [ ] **Step 1: Create `PasswordInput.tsx` (client, show/hide)**

```tsx
"use client";

import { useState } from "react";
import { Input } from "./Field";

export function PasswordInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-16" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-dim hover:text-ink"
        aria-label={show ? "Passwort verbergen" : "Passwort anzeigen"}
      >
        {show ? "verbergen" : "zeigen"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Login page — labels + error + password toggle** — replace `src/app/(auth)/login/page.tsx` with:

```tsx
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn } from "@/auth";
import { Input, Label } from "@/components/ui/Field";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Button } from "@/components/ui/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    try {
      await signIn("credentials", {
        email: String(formData.get("email")),
        password: String(formData.get("password")),
        redirectTo: "/",
      });
    } catch (e) {
      if (e instanceof AuthError) redirect("/login?error=1");
      throw e; // re-throw Next's redirect signal
    }
  }

  return (
    <main className="min-h-screen grid place-items-center bg-vault text-ink p-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6 font-semibold text-lg tracking-tight">
          <span className="grid place-items-center w-7 h-7 rounded-md bg-gold text-vault text-sm font-bold">◆</span>
          OP&nbsp;Vault
        </div>
        <form action={login} className="space-y-3 rounded-xl border border-line bg-surface p-6 shadow-[var(--shadow-pop)]">
          <h1 className="text-lg font-semibold">Login</h1>
          {error && <p className="text-sm text-down" role="alert">E-Mail oder Passwort ist falsch.</p>}
          <label className="block">
            <Label>E-Mail</Label>
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="block">
            <Label>Passwort</Label>
            <PasswordInput name="password" autoComplete="current-password" required />
          </label>
          <Button type="submit" className="w-full">Einloggen</Button>
          <a href="/register" className="block text-center text-sm text-muted hover:text-ink transition-colors">
            Mit Invite registrieren
          </a>
        </form>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Register page — labels + password toggle** — in `src/app/(auth)/register/page.tsx` add `import { Input, Label } from "@/components/ui/Field";` and `import { PasswordInput } from "@/components/ui/PasswordInput";`, then replace the four `<Input ...>` fields with labelled versions:

```tsx
          <label className="block">
            <Label>Anzeigename</Label>
            <Input name="displayName" autoComplete="nickname" required />
          </label>
          <label className="block">
            <Label>E-Mail</Label>
            <Input name="email" type="email" autoComplete="email" required />
          </label>
          <label className="block">
            <Label>Passwort (min. 8 Zeichen)</Label>
            <PasswordInput name="password" autoComplete="new-password" minLength={8} required />
          </label>
          <label className="block">
            <Label>Invite-Code (OP-XXXXXX)</Label>
            <Input name="code" required />
          </label>
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success. Manual: visiting `/login?error=1` shows the error; the password "zeigen/verbergen" toggle works.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/PasswordInput.tsx "src/app/(auth)/login/page.tsx" "src/app/(auth)/register/page.tsx"
git commit -m "feat: auth a11y — labels, password toggle, login error"
```

---

### Task B5: Respect prefers-reduced-motion

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Append to `src/app/globals.css`**

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Verify** — `npm run build` → success.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "a11y: respect prefers-reduced-motion"
```

---

## Phase C — Dashboard & gallery refinement

### Task C1: Dashboard portfolio range toggle

**Files:**
- Modify: `src/services/dashboard.ts`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Make `getDashboard` accept a range** — in `src/services/dashboard.ts` change the signature and the history call:

```ts
export async function getDashboard(userId: string, rangeDays = 90) {
```

and replace `const history = await portfolioHistory(items, 90);` with:

```ts
  const history = await portfolioHistory(items, rangeDays);
```

- [ ] **Step 2: Dashboard reads `?range=` and renders a toggle** — in `src/app/page.tsx`:
  - Change the signature to accept searchParams:

```tsx
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const range = sp.range === "30" || sp.range === "365" ? Number(sp.range) : 90;
  const { totals, movers, count, holdings, history, change30 } = await getDashboard(user.id, range);
```

  - Add a range toggle next to the sparkline. Replace the sparkline wrapper block with:

```tsx
          {series.length >= 2 ? (
            <div className="w-full md:w-72">
              <div className="flex justify-end gap-1 mb-1">
                {[30, 90, 365].map((d) => (
                  <Link
                    key={d}
                    href={d === 90 ? "/" : `/?range=${d}`}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                      range === d ? "bg-raised text-ink" : "text-dim hover:text-ink",
                    )}
                  >
                    {d === 365 ? "1J" : `${d}T`}
                  </Link>
                ))}
              </div>
              <Sparkline data={series} id="portfolio" className="h-16 w-full" />
              <div className="mt-1 flex justify-between text-[10px] text-dim tabular-nums">
                <span>{history[0].date}</span>
                <span>{history[history.length - 1].date}</span>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex w-72 h-16 items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-dim">
              Noch kein Verlauf
            </div>
          )}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success; `/?range=30` and `/?range=365` change the sparkline window.

- [ ] **Step 4: Commit**

```bash
git add src/services/dashboard.ts src/app/page.tsx
git commit -m "feat: dashboard portfolio range toggle (30/90/365)"
```

---

### Task C2: Per-holding 30-day delta badge

**Files:**
- Modify: `src/services/dashboard.ts`
- Modify: `src/components/CollectionCard.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Compute a delta per holding** — in `src/services/dashboard.ts` add a helper above `getDashboard`:

```ts
async function holdingDeltaPct(cardId: string, grade: Grade, sinceDays = 30): Promise<number | null> {
  const since = new Date(Date.now() - sinceDays * 86400_000);
  const [recent, old] = await Promise.all([
    db.priceSnapshot.findFirst({ where: { cardId, grade }, orderBy: { date: "desc" } }),
    db.priceSnapshot.findFirst({ where: { cardId, grade, date: { lte: since } }, orderBy: { date: "desc" } }),
  ]);
  if (recent && old) return pctChange(Number(old.priceEur), Number(recent.priceEur));
  return null;
}
```

Then change the `holdings` construction to async + include `deltaPct`:

```ts
  const holdings = (
    await Promise.all(
      items.map(async (item) => {
        const price = priceMaps.get(item.cardId)?.[item.grade] ?? 0;
        return {
          id: item.id,
          card: item.card,
          grade: item.grade,
          quantity: item.quantity,
          valueEur: price * item.quantity,
          deltaPct: await holdingDeltaPct(item.cardId, item.grade),
        };
      }),
    )
  ).sort((a, b) => b.valueEur - a.valueEur);
```

- [ ] **Step 2: CollectionCard shows the delta** — in `src/components/CollectionCard.tsx` add `deltaPct` to the props and render a small badge under the price. Change the props type to include `deltaPct?: number | null;` and replace the footer price row with:

```tsx
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="text-[10.5px] text-dim truncate">{card.setCode ?? "Promo"}</span>
          <div className="text-right">
            <PriceTag value={valueEur} className="text-[11.5px] whitespace-nowrap" />
            {deltaPct != null && (
              <div className={`text-[10px] tabular-nums ${deltaPct >= 0 ? "text-up" : "text-down"}`}>
                {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}%
              </div>
            )}
          </div>
        </div>
```

Update the component signature to destructure `deltaPct`:

```tsx
export function CollectionCard({
  card,
  grade,
  quantity,
  valueEur,
  deltaPct,
}: {
  card: Card;
  grade: Grade;
  quantity: number;
  valueEur: number;
  deltaPct?: number | null;
}) {
```

- [ ] **Step 3: Pass it through** — in `src/app/page.tsx` add the prop to the holdings map:

```tsx
            <CollectionCard key={h.id} card={h.card} grade={h.grade} quantity={h.quantity} valueEur={h.valueEur} deltaPct={h.deltaPct} />
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success.

- [ ] **Step 5: Commit**

```bash
git add src/services/dashboard.ts src/components/CollectionCard.tsx src/app/page.tsx
git commit -m "feat: per-holding 30-day delta badge on dashboard"
```

---

### Task C3: Gallery rarity chip toolbar

**Files:**
- Modify: `src/app/cards/page.tsx`

- [ ] **Step 1: Replace the rarity `<Select>` with chip links** — in the browse-view filter `<form>`, remove the rarity `<div className="w-36"> <Select name="rarity"> ... </Select> </div>` block. Above the form (or as its own row), render rarity chips that preserve the other params via the existing `keep()` helper:

```tsx
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Link
          href={keep({ rarity: "" })}
          className={`rounded-full border px-3 py-1 text-xs transition-colors ${
            !sp.rarity ? "border-gold/50 text-gold" : "border-line text-dim hover:text-ink"
          }`}
        >
          Alle
        </Link>
        {RARITIES.map((r) => (
          <Link
            key={r}
            href={keep({ rarity: r })}
            className={`rounded-full border px-3 py-1 text-xs transition-colors ${
              sp.rarity === r ? "border-gold/50 text-gold" : "border-line text-dim hover:text-ink"
            }`}
          >
            {r}
          </Link>
        ))}
      </div>
```

Note: `keep()` is defined after the data fetch in the current file; ensure the chip block is rendered in the returned JSX (which is after `keep` is defined). Keep the `q` input + sort `<Select>` + Filtern button in the form.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run build`
Expected: success; clicking a rarity chip filters and preserves `set`/`q`/`sort`.

- [ ] **Step 3: Commit**

```bash
git add src/app/cards/page.tsx
git commit -m "feat: gallery rarity chip toolbar"
```

---

### Task C4: Full UI verification gate

- [ ] **Step 1: Run the whole suite**

Run: `npx tsc --noEmit && npx vitest run && npm run build`
Expected: tsc clean, all Vitest tests pass (88 + new gradeDeltas), build succeeds.

---

## Phase D — Local Postgres for the Raspberry Pi

### Task D1: docker-compose + env + deploy script

**Files:**
- Create: `docker-compose.yml`
- Modify: `.env.example`
- Modify: `package.json`

- [ ] **Step 1: Create `docker-compose.yml`**

```yaml
# Local Postgres for self-hosting (e.g. Raspberry Pi). See docs/self-hosting-pi.md.
services:
  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-opvault}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-opvault}
      POSTGRES_DB: ${POSTGRES_DB:-opvault}
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-opvault}"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 2: Add a commented local URL to `.env.example`** — append:

```bash

# --- Self-hosting (Raspberry Pi): local Postgres via docker-compose.yml ---
# Swap DATABASE_URL above for this when running against the local DB:
# DATABASE_URL="postgresql://opvault:opvault@localhost:5432/opvault?schema=public"
# POSTGRES_USER=opvault
# POSTGRES_PASSWORD=opvault
# POSTGRES_DB=opvault
```

- [ ] **Step 3: Add `db:deploy` script to `package.json`** — in the `scripts` block add:

```json
    "db:deploy": "prisma migrate deploy",
```

- [ ] **Step 4: Verify compose is valid**

Run: `docker compose config`
Expected: prints the resolved config with no error. (If Docker is not installed on the dev machine, skip and note it — this is validated on the Pi.)

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml .env.example package.json
git commit -m "feat: docker-compose local Postgres + db:deploy script"
```

---

### Task D2: Self-hosting documentation

**Files:**
- Create: `docs/self-hosting-pi.md`

- [ ] **Step 1: Create `docs/self-hosting-pi.md`**

````markdown
# Self-Hosting on a Raspberry Pi 4

Run OP Vault entirely on a Pi: local Postgres (Docker), the Next app, and the price job via cron.
Switching between Neon (cloud) and the Pi is just a `DATABASE_URL` change — schema and code are identical.

## 1. Prerequisites

- Raspberry Pi OS (64-bit), Node 20+, and Docker:
  ```bash
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker $USER   # re-login afterwards
  ```

## 2. Start the database

```bash
cd op-tcg-tracker
docker compose up -d db
```

Set these in `.env`:

```bash
DATABASE_URL="postgresql://opvault:opvault@localhost:5432/opvault?schema=public"
POSTGRES_USER=opvault
POSTGRES_PASSWORD=opvault
POSTGRES_DB=opvault
```

## 3. Create the schema

```bash
npm ci
npm run db:deploy      # prisma migrate deploy — applies prisma/migrations
npm run db:generate
```

## 4. Get data — pick ONE

**A) Fresh import**
```bash
npm run seed:owner                 # creates the owner account from OWNER_EMAIL/OWNER_PASSWORD
npm run import:pc:full -- --min=11 # imports the JP catalog (needs PRICECHARTING_TOKEN)
npm run resolve:owned              # resolves any owned off-catalog cards
npm run job:daily                  # pulls current prices
```

**B) Copy existing data from Neon**
```bash
# Dump from Neon (uses your current cloud DATABASE_URL):
pg_dump "postgresql://USER:PASS@HOST/neondb?sslmode=require" \
  --no-owner --no-privileges -Fc -f neon.dump
# Restore into the local DB:
pg_restore --no-owner --clean --if-exists \
  -d "postgresql://opvault:opvault@localhost:5432/opvault" neon.dump
```

## 5. Run the app

```bash
npm run build
npm start            # serves on http://<pi-ip>:3000
```

Optional systemd unit (`/etc/systemd/system/opvault.service`):
```ini
[Unit]
Description=OP Vault
After=network.target docker.service

[Service]
WorkingDirectory=/home/pi/op-tcg-tracker
ExecStart=/usr/bin/npm start
Restart=on-failure
EnvironmentFile=/home/pi/op-tcg-tracker/.env

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable --now opvault
```

## 6. Schedule the price job (replaces Vercel cron)

`crontab -e` → run every 3 days at 04:00:
```cron
0 4 */3 * * cd /home/pi/op-tcg-tracker && /usr/bin/npm run job:daily >> /home/pi/opvault-cron.log 2>&1
```

## Switching back to Neon

Set `DATABASE_URL` back to the Neon URL and restart. No migration or code change needed.
````

- [ ] **Step 2: Commit**

```bash
git add docs/self-hosting-pi.md
git commit -m "docs: Raspberry Pi self-hosting guide (local Postgres + app + cron)"
```

---

### Task D3: Prove the DB flow (if Docker is available)

- [ ] **Step 1: Bring up the DB and apply migrations against it**

```bash
docker compose up -d db
# point a throwaway env at it:
DATABASE_URL="postgresql://opvault:opvault@localhost:5432/opvault?schema=public" npx prisma migrate deploy
```
Expected: "All migrations have been successfully applied." Then `docker compose down` (keep the volume) when done.

If Docker is unavailable on the dev machine, record that this step is to be run on the Pi and that `docker compose config` (Task D1) passed.

---

## Self-Review

**Spec coverage:**
- A. Card-detail elevation → A1 (deltas helper), A2 (range toggle), A3 (sticky image, JP pill, variant tag, grade deltas, watch state, range chart). ✓
- B. Consistency & a11y → B1 (icons), B2 (PageHeader/EmptyState), B3 (apply), B4 (auth labels/password/error), B5 (reduced-motion). ✓
- C. Dashboard/gallery → C1 (range toggle), C2 (per-holding delta), C3 (rarity chips), C4 (gate). ✓
- D. Pi Postgres → D1 (compose/env/script), D2 (docs), D3 (verify). ✓

**Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**Type consistency:** `gradeDeltas(history, days): Record<Grade, number|null>` used identically in A1/A3. `PriceHistory({ data: SeriesPoint[] })` matches `buildPriceSeries` output. `getDashboard(userId, rangeDays=90)` callers updated in C1. `CollectionCard` gains `deltaPct?: number | null`, set in C2 and passed in C2 step 3. `keep()` reused for chips in C3 (already defined in the file before the returned JSX). ✓

## Notes

- No React component-test harness exists; UI tasks are gated by `tsc`, the existing Vitest suite, and `next build`. Only pure logic (`gradeDeltas`) gets a new unit test.
- Phases are independent: A → review → B → C, and D any time.
