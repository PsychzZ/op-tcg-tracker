# UI Refinement + Local Postgres for Raspberry Pi — Design

**Date:** 2026-06-28
**Status:** Approved (design). Awaiting spec review → implementation plan.

## Goal

Two independent deliverables:

1. **UI refinement** — a polish pass on the established **Vault** design system (dark grey + gold).
   Not a redesign: elevate the card-detail page, unify the remaining pages, and add a little life to
   the dashboard/gallery. Build + tests stay green throughout.
2. **Local Postgres for the Pi** — give the project a documented, scripted way to run its database
   locally on a Raspberry Pi 4 instead of (or alongside) Neon, with no schema/query changes.

## Decisions (from brainstorm)

- **Design basis:** no separate design artifact exists; build on the current Vault tokens
  (`src/app/globals.css`) and `src/components/ui/*`, guided by ui-ux-pro-max best practices.
- **UI focus:** card-detail page, cross-page consistency + a11y, dashboard/gallery refinement.
  **Mobile-specific** work is out of scope.
- **UI rollout:** three focused passes (A → B → C), each leaving build + tests green; card-detail
  first so it can be reviewed live before the rest.
- **Pi DB:** **local Postgres via Docker Compose** (keeps Prisma `provider = "postgresql"`, schema and
  queries identical; switch between Neon and Pi by swapping `DATABASE_URL`). Native `apt` install is
  the documented lean alternative.
- Prisma already uses **migrations** (4 in `prisma/migrations/`), so the Pi setup is
  `prisma migrate deploy` — no `db push` divergence.

---

## A. Card-detail page — elevate (`src/app/cards/[id]/page.tsx`)

Already on Vault tokens; this raises it to a premium "hero" without a rebuild.

- **Sticky image column** on desktop (`lg:sticky lg:top-20`), framed in a `Panel`.
- **Header:** add a **variant tag** badge when `card.variant !== "normal"` (Alt Art / Manga / Parallel /
  Serial); replace the `🇯🇵` emoji with a small **"JP" pill** (bordered, `text-dim`).
- **Grade tiles (Raw / PSA 9 / PSA 10):** add a **30-day delta** per grade (▲/▼ %, `text-up`/`text-down`),
  computed from `getPriceHistory`. New pure helper `gradeDeltas(history, days)` in
  `src/domain/movers.ts` (alongside `pctChange`), unit-tested.
- **Price chart:** add a **range toggle** (30 / 90 / 365 days). `PriceChart` is a client component; add a
  thin client wrapper holding the selected range and slicing the series. Respects reduced-motion.
- **Watchlist button:** reflect the real watched state (query `watchlistItem`); filled star + label
  "Beobachtet" when watched, outline star + "Watchlist" otherwise. Uses existing `toggleWatchAction`.

## B. Consistency & accessibility pass (all pages)

- **`src/components/ui/PageHeader.tsx`** — `{ title, subtitle?, action? }`. Replace the hand-rolled
  `h1 + p` on dashboard, cards, watchlist, invites.
- **`src/components/ui/EmptyState.tsx`** — `{ icon?, title, description?, action? }`. Use on watchlist,
  empty collection (dashboard), and the gallery "no results" case.
- **`src/components/ui/icons.tsx`** — small inline SVG set (Star, StarFilled, Search, ChevronLeft, Plus,
  Trash, External). Replace emoji/glyph icons (`★`, `←`, `🇯🇵`) in `CardThumb`, card-detail, nav/back
  links. (ui-ux-pro-max `no-emoji-icons`.) Price direction **keeps `▲/▼`** (geometric, finance
  convention) — only emoji/glyph *icons* are replaced with SVG.
- **Auth pages** (`src/app/(auth)/login`, `register`): visible `<Label>` per field (a11y
  `input-labels`), a **password show/hide toggle** (`PasswordInput` client component), an **error message**
  (NextAuth credentials failure via `?error=` searchParam), and required indicators.
- **`globals.css`:** add a `prefers-reduced-motion: reduce` block neutralising transitions/animations.

## C. Dashboard & gallery refinement

- **Dashboard** (`src/app/page.tsx`, `src/services/dashboard.ts`): **range toggle** (30/90/365) for the
  portfolio sparkline via a `?range=` searchParam (server-side, no extra client JS); **per-holding 30-day
  delta badge** on `CollectionCard` (grade-specific), computed in `getDashboard`.
- **Gallery** (`src/app/cards/page.tsx`): replace the rarity `<select>` with a **chip toolbar** (links that
  set the `rarity` param) with an active state. Keep `q` + sort. Set value/covers already in place.

## D. Local Postgres for the Raspberry Pi

- **`docker-compose.yml`** — one `db` service: `postgres:16-alpine`, named volume `pgdata`, `5432:5432`,
  env (`POSTGRES_USER/PASSWORD/DB`) sourced from `.env`, a `pg_isready` healthcheck. Runs on Pi (arm64)
  and dev machines unchanged.
- **`.env.example`** — add a commented local URL, e.g.
  `DATABASE_URL="postgresql://opvault:opvault@localhost:5432/opvault?schema=public"`.
- **`package.json`** — add `"db:deploy": "prisma migrate deploy"`.
- **`docs/self-hosting-pi.md`** — end-to-end:
  1. Install Docker on Raspberry Pi OS.
  2. `docker compose up -d db` → `npm run db:deploy` → `npm run db:generate`.
  3. Seed: `npm run seed:owner` + `npm run import:pc:full -- --min=11` + `npm run job:daily`
     **or** migrate existing data from Neon (`pg_dump` from Neon → `pg_restore`/`psql` into local;
     documented commands).
  4. Run the app: `npm run build` then `npm start` (with a sample **systemd**/PM2 unit).
  5. Schedule the price job via **system cron** (e.g. `0 4 */3 * *` → `npm run job:daily`, replacing the
     Vercel cron).
  - Note: switching Neon ↔ Pi is just a `DATABASE_URL` change; nothing else.

---

## Rollout / sequencing

1. **Pass A** (card-detail) → user reviews live.
2. **Pass B** (consistency + a11y).
3. **Pass C** (dashboard + gallery).
4. **D** (Pi DB) — independent; can land any time.

## Testing & verification

- **Unit:** `gradeDeltas` / delta helpers (vitest). Keep existing 88 tests green.
- **Each pass:** `npx tsc --noEmit`, `npx vitest run`, `npm run build` all green; no functional regressions.
- **DB:** validate compose with `docker compose config`; if Docker is available locally, bring up the `db`
  service and run `prisma migrate deploy` against it to prove the documented flow. (Actual deployment to
  the user's Pi hardware is out of scope — we can't reach it.)

## Out of scope

- Mobile-specific redesign (touch/layout reflow on small screens).
- Actual deployment onto the user's Pi hardware.
- Migrating to shadcn/ui or changing the visual language.
- Variant-specific image sourcing (separate concern).
