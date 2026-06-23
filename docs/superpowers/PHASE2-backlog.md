# Phase 2 — Backlog

Die MVP (Pläne 1–5) ist umgesetzt, getestet und auf `main`. Diese Liste sammelt
bewusst verschobene Spec-Punkte und die in der finalen Code-Review gefundenen
nicht-kritischen Verbesserungen. (Sicherheit war sauber — nichts davon ist ein Blocker.)

## Preis-Daten echt anschalten (das Wichtigste zuerst)
- **Provider-Keys setzen** (`.env` + Vercel): `FREE_API_BASE` / `FREE_API_KEY`
  (TCG Price Lookup / JustTCG) und/oder eine eBay-Sold-Quelle (`EBAY_SOLD_BASE` / `EBAY_SOLD_KEY`).
- **Mapper gegen echte API-Form verifizieren:** Die Response-Shapes in
  `src/lib/providers/free-api.ts` und `ebay-sold.ts` sind fixture-basiert und im Code als
  „VERIFY against real API" markiert — beim ersten echten Key prüfen/anpassen.
- **Echten Katalog** mit Bildern als `data/cards.ja.json` ablegen (Shape wie `data/cards.sample.json`,
  Quelle z. B. Limitless/apitcg) und `npm run import:catalog` laufen lassen.

## Verschobene Spec-Punkte (aus Plan-Vereinfachung)
1. **Chart-Zeitraum-Umschalter** (30T/90T/1J/Max) — `getPriceHistory` ist aktuell fix 365 Tage;
   Umschalter im Detail-Chart ergänzen.
2. **„Letzte Verkäufe"** auf der Detailseite — `SaleObservation`-Zeilen werden vom Job geschrieben,
   aber noch nicht angezeigt; Liste (Datum/Grade/Preis/Quelle) rendern.
3. **Profil-/Passwort-ändern-Seite** (Spec §6.7) für alle Nutzer.
4. **Sync-Status-Ansicht** (Owner) — letzten `SyncRun` anzeigen + manuellen Katalog-Sync-Button.
5. **Mehr Galerie-Filter** — Variante, Kategorie, „nur meine"/alle, Sortierung (Wert/30T-Trend/Name).

## Hardening aus der Review (Minor)
- `daily-update`: bei Bedarf `WANTED`-Währungen in `ecb-fx.ts` erweitern (Per-Grade-Fehlerisolation
  ist bereits drin, sodass unbekannte Währungen den Lauf nicht mehr abbrechen).
- `auth.config.ts` `authorized`: exakter Pfadvergleich (`=== "/login"`/`"/register"`) statt `startsWith`.
- `dashboard.ts`: die pro-Karte sequenziellen Snapshot-Queries (N×2) für große Sammlungen batchen.
- `prices.ts` `getLatestPriceMap`: `distinct`/`take` statt komplette Historie zu laden.
- Invite `expiresAt` im UI setzbar machen.

## Deploy (Cloud, immer erreichbar)
- Repo zu GitHub pushen, in Vercel importieren.
- Env in Vercel: `DATABASE_URL` (Neon pooled; ggf. `directUrl` für Migrationen), `AUTH_SECRET`,
  `OWNER_EMAIL`, `OWNER_PASSWORD`, `CRON_SECRET`, Provider-Keys (sobald vorhanden).
- Gegen die Prod-DB: `npm run seed:owner` + `npm run import:catalog`.
- Vercel Cron triggert täglich `/api/cron/daily` (Schedule in `vercel.json`).
