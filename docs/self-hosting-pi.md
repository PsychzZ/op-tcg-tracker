# Self-Hosting on a Raspberry Pi 4 (Docker)

The whole stack runs in Docker: **`docker compose up -d`** starts Postgres, applies migrations, serves
the app, and schedules the price sync. No Node/npm needed on the host.

## 1. Prerequisites

Raspberry Pi OS (64-bit) + Docker:
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # then re-login
```

## 2. Configure `.env`

Copy `.env.example` to `.env` and set at least:
```bash
AUTH_SECRET=...            # npx auth secret
OWNER_EMAIL=you@example.com
OWNER_PASSWORD=...         # your login password
PRICECHARTING_TOKEN=...    # for catalog import + price sync
CRON_SECRET=...            # used by the scheduler to call the cron endpoint
# Optional — DB credentials (default to opvault/opvault/opvault):
POSTGRES_USER=opvault
POSTGRES_PASSWORD=opvault
POSTGRES_DB=opvault
```
> `DATABASE_URL` in `.env` is ignored by the containers — the app/migrate/tools services point
> themselves at the `db` service automatically. It only matters if you run things on the host.

## 3. Start everything

```bash
docker compose up -d --build
```

This starts four things:
- **db** — Postgres (data persisted in the `pgdata` volume)
- **migrate** — applies `prisma migrate deploy`, then exits
- **app** — the site on **http://&lt;pi-ip&gt;:3000**
- **cron** — calls the price-sync endpoint every 3 days

Check status / logs:
```bash
docker compose ps
docker compose logs -f app
```

## 4. Seed data (one-off)

The `tools` service runs the maintenance scripts (it uses the full build image). Run once:
```bash
docker compose run --rm tools npm run seed:owner                 # create your owner account
docker compose run --rm tools npm run import:pc:full -- --min=11 # import the JP catalog
docker compose run --rm tools npm run resolve:owned             # resolve owned off-catalog cards
docker compose run --rm tools npm run job:daily                 # pull prices now (cron also does this)
```

### Or: copy existing data from Neon
```bash
pg_dump "postgresql://USER:PASS@HOST/neondb?sslmode=require" --no-owner --no-privileges -Fc -f neon.dump
pg_restore --no-owner --clean --if-exists \
  -d "postgresql://opvault:opvault@localhost:5432/opvault" neon.dump   # db port is published on the host
```

## 5. Update after a code change

```bash
git pull
docker compose up -d --build        # rebuilds app + migrate, re-applies new migrations, restarts
```

## Useful commands

```bash
docker compose down                 # stop (keeps data)
docker compose down -v              # stop and DELETE the database volume
docker compose logs -f cron         # watch the scheduler
docker compose run --rm tools sh    # shell with full deps for ad-hoc scripts
```

## Notes

- First build on a Pi 4 can take several minutes (`next build` is CPU/RAM heavy). It's a one-time cost
  per code change.
- To point at Neon instead of the local DB, run only the `app` service is not enough — the app forces
  the `db` host. For cloud DB, run the app outside compose (`npm run build && npm start`) with your
  Neon `DATABASE_URL`. The Docker stack is meant for the all-local Pi setup.
