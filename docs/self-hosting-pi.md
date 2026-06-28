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
