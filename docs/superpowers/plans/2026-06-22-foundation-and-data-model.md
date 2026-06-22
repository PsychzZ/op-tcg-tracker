# Foundation & Data Model — Implementation Plan (1/5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js project skeleton, the full database schema (Prisma + Postgres/Neon), the test runner, and the testable `isTrackable()` business rule — a booting app on a migrated DB.

**Architecture:** Next.js (App Router, TypeScript, `src/` dir) on Vercel-ready structure. Prisma ORM against a Neon Postgres database. Vitest for tests. Pure domain logic lives in `src/domain/` (framework-free, easy to unit-test); the Prisma client is a single shared singleton in `src/lib/db.ts`.

**Tech Stack:** Next.js 14+, TypeScript, Tailwind CSS, Prisma, PostgreSQL (Neon), Vitest, Testing Library.

**Prerequisites:** Node.js 20+ and npm installed. A free Neon account (https://neon.tech) for the database (Task 4 walks through it).

**Reference spec:** `docs/superpowers/specs/2026-06-22-op-tcg-tracker-design.md`

---

## File Structure (created by this plan)

- `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs` — scaffold (Task 1)
- `src/app/` — App Router root (layout, page) (Task 1)
- `vitest.config.ts`, `vitest.setup.ts` — test runner (Task 2)
- `src/domain/card.ts` — card types/enums + `isTrackable()` rule (Task 3)
- `src/domain/card.test.ts` — unit tests for the rule (Task 3)
- `prisma/schema.prisma` — full data model (Task 4)
- `.env`, `.env.example` — `DATABASE_URL` (Task 4)
- `src/lib/db.ts` — Prisma client singleton (Task 5)
- `src/app/api/health/route.ts` — DB health check endpoint (Task 5)

---

## Task 1: Scaffold the Next.js app

**Files:** creates the whole Next.js scaffold in the repo root.

- [ ] **Step 1: Move the gitignored brainstorm folder aside so the scaffolder won't choke on it**

`.superpowers/` is the only pre-existing entry that `create-next-app` treats as a conflict (`docs/`, `.git`, `.gitignore` are allowed).

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
[ -d .superpowers ] && mv .superpowers ../.op-superpowers-stash || echo "no .superpowers to move"
```

- [ ] **Step 2: Run the scaffolder in the current directory**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --no-turbopack
```

Expected: prompts may appear; accept defaults. Finishes with "Success! Created ... " and a populated `src/app/`, `package.json`, etc.

- [ ] **Step 3: Restore the brainstorm folder and re-add its ignore rule**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
[ -d ../.op-superpowers-stash ] && mv ../.op-superpowers-stash .superpowers || echo "nothing to restore"
grep -q "^.superpowers/" .gitignore || printf '\n# Superpowers brainstorming companion (local mockups)\n.superpowers/\n' >> .gitignore
```

- [ ] **Step 4: Verify the dev server boots**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm run dev
```

Expected: "Ready in ... " and a local URL (http://localhost:3000). Open it, confirm the Next.js starter renders, then stop the server (Ctrl+C).

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
git add -A
git commit -m "chore: scaffold Next.js app (TS, Tailwind, App Router)"
```

---

## Task 2: Set up Vitest

**Files:**
- Create: `vitest.config.ts`, `vitest.setup.ts`
- Modify: `package.json` (add `test` script + dev deps)

- [ ] **Step 1: Install test dependencies**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm install -D vitest@^2 jsdom @testing-library/react @testing-library/jest-dom @vitejs/plugin-react
```

Expected: packages added to `devDependencies`.

- [ ] **Step 2: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    globals: true,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Add the `test` script to `package.json`**

In `package.json`, inside `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Add a smoke test to prove the runner works**

Create `src/domain/smoke.test.ts`:

```ts
import { describe, it, expect } from "vitest";

describe("test runner", () => {
  it("runs", () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 6: Run the tests**

```bash
npm test
```

Expected: PASS, 1 test passed.

- [ ] **Step 7: Remove the smoke test and commit**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
rm src/domain/smoke.test.ts
git add -A
git commit -m "test: set up Vitest with jsdom + Testing Library"
```

---

## Task 3: Domain types + `isTrackable()` rule (TDD)

This is the spec's inviolable "Regel #2" (and Rule #1: JP-only). It is pure logic — no DB, no framework.

**Files:**
- Create: `src/domain/card.ts`
- Test: `src/domain/card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/domain/card.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { isTrackable, type TrackableCard } from "./card";

function card(overrides: Partial<TrackableCard> = {}): TrackableCard {
  return {
    language: "ja",
    rarity: "SR",
    variant: "normal",
    category: "booster",
    trackOverride: null,
    ...overrides,
  };
}

describe("isTrackable", () => {
  it("tracks SR and SEC", () => {
    expect(isTrackable(card({ rarity: "SR" }))).toBe(true);
    expect(isTrackable(card({ rarity: "SEC" }))).toBe(true);
  });

  it("tracks SP and Leader", () => {
    expect(isTrackable(card({ rarity: "SP" }))).toBe(true);
    expect(isTrackable(card({ rarity: "L" }))).toBe(true);
  });

  it("does NOT track normal C / UC / R", () => {
    expect(isTrackable(card({ rarity: "C" }))).toBe(false);
    expect(isTrackable(card({ rarity: "UC" }))).toBe(false);
    expect(isTrackable(card({ rarity: "R" }))).toBe(false);
  });

  it("tracks special variants regardless of base rarity", () => {
    expect(isTrackable(card({ rarity: "C", variant: "altArt" }))).toBe(true);
    expect(isTrackable(card({ rarity: "R", variant: "mangaArt" }))).toBe(true);
    expect(isTrackable(card({ rarity: "UC", variant: "parallel" }))).toBe(true);
    expect(isTrackable(card({ rarity: "C", variant: "serial" }))).toBe(true);
  });

  it("tracks promos and special collabs", () => {
    expect(isTrackable(card({ rarity: "R", category: "promo" }))).toBe(true);
    expect(isTrackable(card({ rarity: "C", category: "specialCollab" }))).toBe(true);
  });

  it("never tracks non-Japanese cards (Rule #1, inviolable)", () => {
    expect(isTrackable(card({ language: "en", rarity: "SEC" }))).toBe(false);
    // even a manual override cannot force a non-JP card in:
    expect(isTrackable(card({ language: "en", trackOverride: true }))).toBe(false);
  });

  it("honors manual override for Japanese cards", () => {
    expect(isTrackable(card({ rarity: "C", trackOverride: true }))).toBe(true);
    expect(isTrackable(card({ rarity: "SEC", trackOverride: false }))).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npm test -- src/domain/card.test.ts
```

Expected: FAIL — cannot resolve `./card` / `isTrackable is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/domain/card.ts`:

```ts
export type Rarity = "C" | "UC" | "R" | "SR" | "SEC" | "SP" | "L";
export type Variant = "normal" | "altArt" | "mangaArt" | "parallel" | "serial";
export type Category = "booster" | "starter" | "promo" | "specialCollab";
export type Grade = "raw" | "psa9" | "psa10";

export interface TrackableCard {
  language: string;
  rarity: Rarity;
  variant: Variant;
  category: Category;
  trackOverride?: boolean | null;
}

const TRACKED_RARITIES: Rarity[] = ["SR", "SEC", "SP", "L"];
const TRACKED_VARIANTS: Variant[] = ["altArt", "mangaArt", "parallel", "serial"];
const TRACKED_CATEGORIES: Category[] = ["promo", "specialCollab"];

/**
 * Decides whether a card is tracked.
 * Rule #1 (inviolable): only Japanese cards. Non-JP is never tracked, even with an override.
 * Otherwise: a manual override wins; else track SR/SEC/SP/L, any special variant,
 * or promo/special-collab cards. Plain C/UC/R are excluded.
 */
export function isTrackable(card: TrackableCard): boolean {
  if (card.language !== "ja") return false;
  if (card.trackOverride === true) return true;
  if (card.trackOverride === false) return false;
  return (
    TRACKED_RARITIES.includes(card.rarity) ||
    TRACKED_VARIANTS.includes(card.variant) ||
    TRACKED_CATEGORIES.includes(card.category)
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- src/domain/card.test.ts
```

Expected: PASS — all `isTrackable` tests green.

- [ ] **Step 5: Commit**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
git add src/domain/card.ts src/domain/card.test.ts
git commit -m "feat: add isTrackable card rule (JP-only + special rarities/variants)"
```

---

## Task 4: Prisma + full schema + Neon database

**Files:**
- Create: `prisma/schema.prisma`, `.env`, `.env.example`
- Modify: `package.json` (Prisma scripts)

- [ ] **Step 1: Install Prisma**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm install -D prisma
npm install @prisma/client
```

- [ ] **Step 2: Create the Neon database and capture its connection string**

In the browser: sign in at https://neon.tech → create a project (name: `op-tcg-tracker`) → copy the **pooled** connection string (looks like `postgresql://user:pass@ep-xxx-pooler.<region>.aws.neon.tech/neondb?sslmode=require`).

- [ ] **Step 3: Create `.env` and `.env.example`**

`.env` (real value — already gitignored by the Next.js scaffold):

```
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
```

`.env.example` (committed template, no secret):

```
DATABASE_URL="postgresql://user:password@host-pooler.region.aws.neon.tech/neondb?sslmode=require"
```

- [ ] **Step 4: Create `prisma/schema.prisma`**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role { owner friend }
enum Grade { raw psa9 psa10 }
enum Rarity { C UC R SR SEC SP L }
enum Variant { normal altArt mangaArt parallel serial }
enum Category { booster starter promo specialCollab }
enum PriceSource { ebaySold freeApi }
enum SyncStatus { running success failed }

model User {
  id             String           @id @default(cuid())
  email          String           @unique
  passwordHash   String
  displayName    String
  role           Role             @default(friend)
  createdAt      DateTime         @default(now())
  collection     CollectionItem[]
  watchlist      WatchlistItem[]
  invitesCreated InviteCode[]     @relation("InviteCreator")
}

model InviteCode {
  id          String    @id @default(cuid())
  code        String    @unique
  createdById String
  createdBy   User      @relation("InviteCreator", fields: [createdById], references: [id])
  note        String?
  maxUses     Int       @default(1)
  usesCount   Int       @default(0)
  expiresAt   DateTime?
  createdAt   DateTime  @default(now())
}

model Card {
  id               String            @id @default(cuid())
  name             String
  nameJp           String?
  setCode          String?
  number           String?
  rarity           Rarity
  variant          Variant           @default(normal)
  category         Category          @default(booster)
  language         String            @default("ja")
  imageUrl         String?
  providerIds      Json?
  trackOverride    Boolean?
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
  collectionItems  CollectionItem[]
  watchlistItems   WatchlistItem[]
  priceSnapshots   PriceSnapshot[]
  saleObservations SaleObservation[]

  @@index([setCode])
  @@index([rarity])
}

model CollectionItem {
  id                   String    @id @default(cuid())
  userId               String
  user                 User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  cardId               String
  card                 Card      @relation(fields: [cardId], references: [id])
  grade                Grade
  quantity             Int       @default(1)
  purchasePricePerUnit Decimal?  @db.Decimal(12, 2)
  purchaseCurrency     String?
  purchaseDate         DateTime?
  condition            String?
  notes                String?
  createdAt            DateTime  @default(now())
  updatedAt            DateTime  @updatedAt

  @@unique([userId, cardId, grade])
}

model PriceSnapshot {
  id          String      @id @default(cuid())
  cardId      String
  card        Card        @relation(fields: [cardId], references: [id])
  grade       Grade
  date        DateTime    @db.Date
  priceNative Decimal     @db.Decimal(12, 2)
  currency    String
  priceEur    Decimal     @db.Decimal(12, 2)
  fxRate      Decimal     @db.Decimal(18, 8)
  source      PriceSource
  sampleSize  Int?
  createdAt   DateTime    @default(now())

  @@unique([cardId, grade, date])
  @@index([cardId, grade])
}

model SaleObservation {
  id          String      @id @default(cuid())
  cardId      String
  card        Card        @relation(fields: [cardId], references: [id])
  grade       Grade
  saleDate    DateTime    @db.Date
  priceNative Decimal     @db.Decimal(12, 2)
  currency    String
  priceEur    Decimal     @db.Decimal(12, 2)
  source      PriceSource
  url         String?
  createdAt   DateTime    @default(now())

  @@index([cardId, grade])
}

model WatchlistItem {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  cardId      String
  card        Card     @relation(fields: [cardId], references: [id])
  grade       Grade?
  targetPrice Decimal? @db.Decimal(12, 2)
  createdAt   DateTime @default(now())

  @@unique([userId, cardId])
}

model FxRate {
  id       String   @id @default(cuid())
  date     DateTime @db.Date
  currency String
  rate     Decimal  @db.Decimal(18, 8)

  @@unique([date, currency])
}

model SyncRun {
  id           String     @id @default(cuid())
  startedAt    DateTime   @default(now())
  finishedAt   DateTime?
  cardsUpdated Int        @default(0)
  errors       Json?
  status       SyncStatus @default(running)
}
```

- [ ] **Step 5: Add Prisma scripts to `package.json`**

In `"scripts"`, add:

```json
"db:migrate": "prisma migrate dev",
"db:generate": "prisma generate",
"db:studio": "prisma studio"
```

- [ ] **Step 6: Create and apply the first migration**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npx prisma migrate dev --name init
```

Expected: "Your database is now in sync with your schema." and a new folder `prisma/migrations/<timestamp>_init/`. The Prisma client is generated automatically.

- [ ] **Step 7: Commit**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
git add prisma .env.example package.json package-lock.json
git commit -m "feat: add Prisma schema and initial migration (full data model)"
```

> Note: `.env` must NOT be committed — confirm `git status` does not list it (the scaffold's `.gitignore` ignores `.env*`).

---

## Task 5: Prisma client singleton + health check route

**Files:**
- Create: `src/lib/db.ts`, `src/app/api/health/route.ts`

- [ ] **Step 1: Create the Prisma singleton**

Create `src/lib/db.ts` (avoids exhausting connections during Next.js hot-reload):

```ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- [ ] **Step 2: Create the health check route**

Create `src/app/api/health/route.ts`:

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", db: "connected" });
  } catch (error) {
    return NextResponse.json(
      { status: "error", db: "unreachable", message: String(error) },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 3: Verify the route against the real DB**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm run dev
```

In a second terminal:

```bash
curl -s http://localhost:3000/api/health
```

Expected: `{"status":"ok","db":"connected"}`. Stop the dev server (Ctrl+C).

- [ ] **Step 4: Commit**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
git add src/lib/db.ts src/app/api/health/route.ts
git commit -m "feat: add Prisma client singleton and /api/health DB check"
```

---

## Task 6: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npm test
```

Expected: PASS — all `isTrackable` tests green, no failures.

- [ ] **Step 2: Type-check and lint**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
npx tsc --noEmit
npm run lint
```

Expected: no type errors; lint passes (or only trivial warnings).

- [ ] **Step 3: Confirm clean git state**

```bash
cd "C:/Users/maxel/projects/op-tcg-tracker"
git status
```

Expected: working tree clean; `.env` not tracked.

---

## Self-Review (completed by author)

- **Spec coverage:** Covers spec §3 (stack: Next.js/TS/Tailwind/Prisma/Postgres/Vitest), §4 (full data model incl. User, InviteCode, Card, CollectionItem, PriceSnapshot, SaleObservation, WatchlistItem, FxRate, SyncRun), and the §2 `isTrackable` rule. Auth wiring, catalog import, pricing/cron, and UI are intentionally deferred to Plans 2–5.
- **Placeholder scan:** No TBD/TODO; every code/command step shows full content.
- **Type consistency:** `Grade`/`Rarity`/`Variant`/`Category` names match between `src/domain/card.ts` and `prisma/schema.prisma` enums; `isTrackable` field names match the test helper and the `Card` model.
- **Deferred to later plans (by design):** seeding the owner user, invite codes, catalog data, price providers, and pages.
