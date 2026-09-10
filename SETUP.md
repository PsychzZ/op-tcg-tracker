# SETUP — One Piece TCG Tracker

How to run this project locally, in Docker (Raspberry Pi), and in the cloud.
For an overview of the app itself, see [README.md](./README.md).

- [1. Prerequisites](#1-prerequisites)
- [2. Environment variables](#2-environment-variables)
- [3. Local development](#3-local-development)
- [4. Scripts for data (seed / catalog / price sync)](#4-scripts-for-data-seed--catalog--price-sync)
- [5. Full Docker stack (Raspberry Pi)](#5-full-docker-stack-raspberry-pi)
- [6. Cloud deployment (Vercel + Neon)](#6-cloud-deployment-vercel--neon)
- [7. Tests, lint, build](#7-tests-lint-build)
- [8. Troubleshooting](#8-troubleshooting)

---

## 1. Prerequisites

| Tool | Version | Needed for |
| --- | --- | --- |
| Node.js | 20 or newer (the Docker image uses `node:20-alpine`) | everything except the pure-Docker path |
| npm | bundled with Node | dependency install |
| PostgreSQL | 16 | database — local Docker Compose is the easy route |
| Docker + Compose | recent | local database container, or the full self-hosted stack |
| git | any | cloning |

No database server is required on the machine itself — `docker compose up -d db` starts only the
Postgres service without the rest of the stack.

## 2. Environment variables

Copy the template and fill it in:

```bash
cp .env.example .env
```

`.env` is git-ignored; never commit real secrets.

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string used by Prisma. |
| `AUTH_SECRET` | yes | Signs/encrypts the Auth.js session JWT. Generate with `npx auth secret` or `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `OWNER_EMAIL` | yes | Bootstrap account. The user registering with this exact e-mail gets the `owner` role; everyone else is a `friend`. |
| `OWNER_PASSWORD` | yes | Password for the seeded owner account (`npm run seed:owner`). |
| `CRON_SECRET` | yes (for scheduling) | Bearer token required by the scheduled endpoints (`/api/cron/daily`, `/api/cron/catalog`). Use a random hex string. If it is unset, both endpoints reject every request. |
| `PRICECHARTING_TOKEN` | recommended | 40-character token from a PriceCharting Collector subscription. Used by the API-based import/resolve scripts and by the per-card price provider. The set-page scraping used by the price sync *and* the catalog refresh works without it. |
| `APIFY_TOKEN`, `APIFY_EBAY_ACTOR` | optional | eBay sold-listing scraper used by the eBay-sold provider. That provider is currently **not** wired into the scheduled sync, so these are only needed if you call it directly. |
| `ALERT_WEBHOOK_URL` | optional | Discord/Slack-style incoming webhook. When set, every fired target-price alert is posted there; without it alerts live in the app only (dashboard + watchlist). |
| `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` | Docker only | Credentials for the Compose Postgres service (defaults `opvault` / `opvault` / `opvault`). |

Not in `.env.example` and currently unused by the scheduled paths — the free-API/TGGGo adapters
(`FREE_API_BASE`, `FREE_API_KEY`, `TCGGO_BASE`, `TCGGO_HOST`, `TCGGO_KEY`). See
[docs/superpowers/PHASE2-backlog.md](./docs/superpowers/PHASE2-backlog.md).

## 3. Local development

```bash
git clone https://github.com/PsychzZ/op-tcg-tracker.git
cd op-tcg-tracker
npm ci
cp .env.example .env
```

**a. Start a local database** (or point `DATABASE_URL` at Neon/an existing Postgres):

```bash
docker compose up -d db
```

Then set `DATABASE_URL` in `.env` to the host-visible connection string:

```bash
DATABASE_URL="postgresql://opvault:opvault@localhost:5432/opvault?schema=public"
# plus POSTGRES_USER / POSTGRES_PASSWORD / POSTGRES_DB if you changed them
```

> The Compose service publishes port `5432` on purpose, so tools running on the host (Prisma CLI,
> `prisma studio`, `pg_restore`) can reach the database.

**b. Create the schema and your account**

```bash
npm run db:migrate   # applies prisma/migrations (dev: creates new migrations if the schema changed)
npm run seed:owner   # creates/updates the user from OWNER_EMAIL + OWNER_PASSWORD with role=owner
```

**c. Start the app**

```bash
npm run dev          # http://localhost:3000
```

Log in with `OWNER_EMAIL` / `OWNER_PASSWORD`. Health check: <http://localhost:3000/api/health>
returns `{"status":"ok","db":"connected"}`.

From here you can either import a catalog (next section) or add cards manually through the UI.

**Database commands**

| Command | Purpose |
| --- | --- |
| `npm run db:migrate` | `prisma migrate dev` — apply migrations and create a new one when `schema.prisma` changed. |
| `npm run db:deploy` | `prisma migrate deploy` — apply existing migrations only (production/containers). |
| `npm run db:generate` | Regenerate the Prisma client after a schema change. |
| `npm run db:studio` | Open Prisma Studio against `DATABASE_URL`. |

## 4. Scripts for data (seed / catalog / price sync)

All scripts read `.env` via `dotenv` and run with `tsx`.

| Command | What it does | Needs |
| --- | --- | --- |
| `npm run seed:owner` | Create/refresh the owner account from `OWNER_EMAIL` + `OWNER_PASSWORD`. | `OWNER_*` |
| `npm run import:catalog` | Import a local card list into the shared catalog. Reads `data/cards.ja.json`, falling back to the bundled `data/cards.sample.json`. | `data/*.json` |
| `npm run import:pc` | Import Japanese specials from PriceCharting for a hard-coded query list in `scripts/import-pricecharting.ts`. | `PRICECHARTING_TOKEN` |
| `npm run job:catalog` (alias `import:pc:full`) | Refresh the catalog from PriceCharting's Japanese sets: `--min=11` (USD threshold) `--max-sets=5` `--max-images=300` `--no-images`. Slow (one page per set, ~1.2 s apart). Same code path as the weekly cron endpoint. | network |
| `npm run resolve:owned` | Resolve owned/watched cards that have no PriceCharting id and/or no image (mostly Western promos/collabs). Stores the product id, its console slug and the card image. | `PRICECHARTING_TOKEN` |
| `npm run backfill:images` | Fetch missing card images from PriceCharting product pages. | network |
| `npm run normalize:catalog` | One-off cleanup: recompute `setCode`/`category` from the card number and drop non-single/sealed rows. Owned or watched cards are never deleted. | database |
| `npm run prune:catalog` | Drop cards below a price threshold, without an image, or without any price (`--threshold=10` by default). Owned, watched and **sold** cards are kept. | database |
| `npm run job:daily` | Run the price sync once, right now — same code path the scheduler calls (prices + alerts). | `DATABASE_URL` |

**Price sync** (`src/services/price-sync.ts`) does four things per run:

1. Downloads the ECB reference rates and upserts them into `FxRate`.
2. Scrapes the PriceCharting set pages once per set and matches rows to local cards by their stored
   PriceCharting product id — no per-card API calls, ~1.2 s between sets.
3. Upserts one `PriceSnapshot` per card / grade / day (`raw`, `psa9`, `psa10`) in EUR, recording the
   source, the native price and the FX rate used, then logs a `SyncRun` row.
4. Evaluates every user's target-price rules (`evaluateAlerts`) and records what fires as a
   `PriceAlert` — one per user / card / grade / day — optionally posting a summary to
   `ALERT_WEBHOOK_URL`.

It is idempotent: running it twice on the same day updates the same snapshot rows and cannot
duplicate an alert. A rule fires when the price crosses down to the target, or on the first
evaluation after the target was set if the price is already at/below it; it stays quiet while the
price remains low and re-arms after a recovery.

**Catalog refresh** (`src/services/catalog-refresh.ts`) is the only writer for new catalog rows:

1. Reads the Japanese category page and walks every set page.
2. Keeps cards whose raw price is at least the threshold, classifies them with the same rules the
   app uses (`classifyPcCard` + `isTrackable`), so the number decides set and category.
3. Stores a per-variant PriceCharting image for alt-art / manga / parallel / serial cards and for
   promos — exactly the rows where the official per-number artwork would be wrong or unavailable.
4. Reports `sets / scanned / eligible / created / updated / imagesStored / imagesSkipped / errors`,
   isolating a failed set instead of aborting the run.

Image fetching is **capped per run** (`--max-images`, 300 by default): a full catalog needs one page
per variant/promo card, so each run stays short and the deferred images (`imagesSkipped`) are picked
up by the next — already stored images are never re-fetched, so repeated runs converge. Use
`--max-images=0` only for a patient one-off run, and `--no-images` to skip images entirely.

**Scheduling**

- **Vercel:** `vercel.json` registers two crons — `/api/cron/daily` with `0 4 */3 * *` (prices +
  alerts every three days) and `/api/cron/catalog` with `0 5 * * 1` (catalog refresh, Mondays).
- **Docker/Pi:** the compose `cron` service calls `/api/cron/daily` inside the network every 3 days;
  run `docker compose run --rm tools npm run job:catalog` (or a host cron) for the refresh.

Both endpoints require `Authorization: Bearer $CRON_SECRET` and reject everything else with a 401 —
including requests when the variable is unset.

## 5. Full Docker stack (Raspberry Pi)

`docker compose up -d --build` starts Postgres, applies migrations, serves the app on port 3000 and
runs the scheduler. One-off tasks (seed, imports, manual sync) use the profile-gated `tools`
service:

```bash
docker compose run --rm tools npm run seed:owner
docker compose run --rm tools npm run job:catalog -- --min=11
```

On a Pi the containers ignore `DATABASE_URL` from `.env` and point themselves at the `db` service —
so the same `.env` works for host and container runs.

Step-by-step guide, updates and backup/restore:
**[docs/self-hosting-pi.md](./docs/self-hosting-pi.md)**.

> Because the compose `app` service forces the `db` host, cloud databases do **not** work through
> Compose. For Neon, run the app outside Docker (`npm run build && npm start`).

## 6. Cloud deployment (Vercel + Neon)

1. Push the repository to GitHub and import it into Vercel.
2. Set the environment variables in Vercel: `DATABASE_URL` (Neon pooled connection string),
   `AUTH_SECRET`, `OWNER_EMAIL`, `OWNER_PASSWORD`, `CRON_SECRET`, and `PRICECHARTING_TOKEN` as soon
   as you have one.
3. Apply the schema and seed the data against the production database:
   ```bash
   DATABASE_URL="<neon-url>" npx prisma migrate deploy
   DATABASE_URL="<neon-url>" npm run seed:owner
   DATABASE_URL="<neon-url>" npm run job:catalog -- --min=11
   ```
4. Vercel Cron picks up `vercel.json` automatically (daily job every three days, catalog refresh on
   Mondays). `CRON_SECRET` must be set there too, otherwise the endpoints return 401.

The Docker image (`Dockerfile`) builds a Next.js `standalone` bundle; the `runner` stage contains
only the server, the static assets and the Prisma client/engine.

## 7. Tests, lint, build

```bash
npm test          # unit tests (vitest, jsdom) — no database, ~2 s
npm run test:watch
npm run test:int  # integration tests (*.itest.ts) — needs a migrated dev database
npm run lint      # eslint (flat config)
npm run build     # next build (also type-checks)
```

Unit tests cover the pure `src/domain/*` modules and provider mappers. Integration tests run against
`DATABASE_URL`: `collection.itest.ts` (per-user data isolation), `alerts.itest.ts` (alert lifecycle,
idempotency, isolation), `sales.itest.ts` (sell flow, cost basis, ownership guards) and
`catalog-refresh.itest.ts` (catalog rows land complete, with variant-correct images). GitHub Actions
(`.github/workflows/ci.yml`) runs lint, unit tests and the build on every PR, plus the integration
suites against a fresh Postgres 16 service.

## 8. Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `Can't reach database server` on `npm run db:migrate` | Local Postgres is not running, or `DATABASE_URL` still points at the Neon placeholder from `.env.example`. |
| `Environment variable not found: DATABASE_URL` | `.env` is missing — copy `.env.example` and edit it. |
| Login fails right after setup | The owner account has not been seeded: run `npm run seed:owner` (it uses `OWNER_EMAIL` / `OWNER_PASSWORD`). |
| `INVALID_INVITE` when registering a friend | Registering requires a usable invite code — create one as owner under `/settings/invites`. The owner e-mail itself can also register. |
| Prices stay empty | The sync only fills grades it can find; make sure cards have a PriceCharting product id (import/resolve scripts) and run `npm run job:daily`. |
| A card shows "kein Bild" or the base art | Base cards with a standard number use the official proxy URL; alt-art/manga/parallel/serial cards and promos need a stored provider image — run `npm run job:catalog` (or `backfill:images`) to fetch them. |
| Catalog refresh takes minutes, or defers images | It walks one page per set at ~1.2 s each and fetches at most `--max-images` pictures per run (300 by default), reporting the rest as `imagesSkipped`. That is fine self-hosted; on Vercel check your plan's function timeout, otherwise run the refresh from the Pi (`npm run job:catalog`) and let Vercel serve only the app. |
| A target price never fires | Alerts are evaluated by the price sync, so the job has to run (`npm run job:daily` or the scheduler); the target must belong to the grade you want to watch, and the price has to reach it once. Already-reached targets fire on the next evaluation, then stay quiet until the price recovers. |
| No webhook message | `ALERT_WEBHOOK_URL` is unset or the endpoint rejected the POST — alerts are still recorded and shown on the dashboard/watchlist. |
| A sale changed nothing | Selling is refused when the holding is gone or smaller than the quantity you entered (a stale page); reload `/sales` and try again. A sale without a purchase price is recorded but deliberately excluded from the P/L. |
| `no USD FX rate available` in the job | The ECB rate download failed (offline/blocked) — the run aborts on purpose rather than writing wrong EUR values. |
| Cloud DB unreachable from the Compose stack | The `app`/`migrate` services override `DATABASE_URL` to the internal `db` host; run against Neon outside Docker. |
| Prisma engine errors in the Alpine image | The image installs `openssl` in the base stage for that reason; keep it when editing the `Dockerfile`. |
| Route protection not applied after upgrading Next.js | This project uses the Next.js 16 `proxy.ts` middleware convention (`src/proxy.ts`) instead of `middleware.ts`. |
