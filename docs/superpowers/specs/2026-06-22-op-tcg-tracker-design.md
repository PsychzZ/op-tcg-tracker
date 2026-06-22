# One Piece TCG Tracker — Design / Spec

- **Datum:** 2026-06-22
- **Status:** Entwurf zur Freigabe
- **Art:** Persönliche Single-User Web-App (Cloud, immer erreichbar)

---

## 1. Ziel & Kontext

Eine persönliche Web-App zum Verwalten der eigenen One-Piece-TCG-Sammlung und zum
Verfolgen des Marktwerts inkl. Preisentwicklung über die Zeit. Nur der Eigentümer
nutzt sie (Single-User), Daten liegen dauerhaft in einer Datenbank.

Schwerpunkt: **seltene/besondere japanische Karten** und deren Wert in den Stufen
**Raw / PSA 9 / PSA 10**, inkl. **historischer Preis-Charts**.

---

## 2. Scope

### In-Scope
- Verwaltung der eigenen Sammlung (CRUD) für getrackte Karten
- Karten-Katalog (nur japanische Spezialkarten) mit Bild, Set, Rarität, Variante
- Preise je Karte in drei Stufen: **Raw, PSA 9, PSA 10**, Anzeige in **EUR**
  (Originalwährung JPY/USD als Referenz)
- Historische Preis-Charts pro Karte (Raw/PSA 9/PSA 10) + Zeiträume 30T/90T/1J/Max
- Dashboard: Gesamtwert, Wertentwicklung, Top-Mover, Verteilung
- Watchlist, Suche/Filter
- Täglicher, automatischer Preis-Aktualisierungs-Job (Cloud-Cron)

### Out-of-Scope (bewusst nicht)
- Nicht-japanische Karten (EN o. a.) — werden **nie** importiert/angezeigt
- Normale C / UC / R (ohne Spezial-Variante)
- Multi-User, Social-Features, Handel/Marktplatz
- Mobile-Native-App (Web ist responsive; PWA optional später)

### Tracking-Regel (`isTrackable`)
Eine Karte wird getrackt, wenn **Sprache = Japanisch** UND mindestens eins gilt:
- Rarität ∈ { **SR, SEC, SP/Special, L (Leader)** }
- Variante ∈ { **Alt-Art, Manga/Comic, Parallel, Serial/Signed** } (egal welche Basis-Rarität)
- Kategorie = **Promo** oder **Special-Collab** (z. B. BVB×Luffy)

Ausgeschlossen: normale **C / UC / R**.
Zusätzlich **manueller Override pro Karte** (`trackOverride`: erzwingt include/exclude),
damit Sonderfälle immer erfassbar sind. Die Regel ist eine reine Funktion
`isTrackable(card): boolean` und damit testbar.

---

## 3. Tech-Stack & Architektur

- **Next.js (App Router) + TypeScript** — UI + API-Routen in einem Projekt
- **Tailwind CSS** — Styling, „Vault"-Palette als Design-Tokens (siehe §7)
- **PostgreSQL** (Neon Free-Tier) via **Prisma** ORM
- **Recharts** — Charts (3-Serien-Linienchart, Flächen)
- **Vercel** — Hosting + Deploy; **Vercel Cron** für den täglichen Job
- **Auth.js (NextAuth)** — Single-User-Login (App bleibt privat, nicht öffentlich)
- **FX:** EZB-Tageskurse (EUR-Basis), kostenlos

### Austauschbare Schnittstellen (Kern der „später-upgraden"-Strategie)
- `CatalogSource` — liefert/aktualisiert Kartendaten. MVP: Import aus Community-Quelle
  (Limitless / apitcg / Datensatz) in einen **lokalen Katalog** (keine Laufzeit-Abhängigkeit).
- `PriceProvider` — liefert Preise je Karte/Grade. Mehrere Implementierungen:
  - `EbaySoldProvider` — echte PSA-9/10-Verkäufe + JP (Primär für Graded-Preise & Historie)
  - `FreeApiProvider` — kostenlose API (TCG Price Lookup / JustTCG) für Abdeckung
  - `PriceChartingProvider` — nutzt Collector-Token gegen `/api/product` (best-effort/experimentell;
    wird Primärquelle, falls später Legendary-Abo)
- `PriceResolver` — wählt pro Karte/Grade die beste verfügbare Quelle (Priorität + Qualität,
  z. B. eBay-Sold mit ausreichender Sample-Size > Gratis-API > PriceCharting > manuell) und
  schreibt einen **aufgelösten** Tageswert mit **Quellen-Herkunft** (provenance).

Designprinzip: kleine, klar abgegrenzte Module mit definierten Interfaces, je einzeln testbar.

---

## 4. Datenmodell (Prisma-Entities)

**Card** (Katalog)
- `id`, `name`, `nameJp`
- `setCode?` (nullable — Collab-Promos haben ggf. keine klassische Set-Nr.)
- `number?`, `rarity` (enum), `variant` (enum: normal/altArt/mangaArt/parallel/serial)
- `category` (enum: booster/starter/promo/specialCollab)
- `language` = `"ja"` (fix)
- `imageUrl?`
- `providerIds` (JSON: { pricecharting?, freeApi?, ebayQuery? })
- `trackOverride?` (bool, optional) · abgeleitet: `isTrackable(card)`
- `createdAt`, `updatedAt`

**CollectionItem** (dein Bestand) — Schlüssel (cardId, grade)
- `id`, `cardId→Card`, `grade` (enum: raw/psa9/psa10)
- `quantity`, `purchasePricePerUnit?`, `purchaseCurrency?`, `purchaseDate?`
- `condition?` (für raw), `notes?`
- *Mehrere Lots pro (Karte,Grade) = spätere Erweiterung; MVP: 1 Zeile, Menge + Ø-Kaufpreis.*

**PriceSnapshot** (aufgelöster Tageswert) — eindeutig (cardId, grade, date)
- `id`, `cardId`, `grade`, `date`
- `priceNative`, `currency`, `priceEur`, `fxRate`
- `source` (enum: ebaySold/freeApi/pricecharting/manual), `sampleSize?`
- *Aus diesen Zeilen entstehen die Charts; idempotent pro Tag.*

**SaleObservation** (echte Verkäufe)
- `id`, `cardId`, `grade`, `saleDate`
- `priceNative`, `currency`, `priceEur`, `source`, `url?`
- *Speist „Letzte Verkäufe" und ermöglicht Historie-Backfill.*

**ManualPrice** (optional, ToS-sicheres PriceCharting-Referenzfeld)
- `id`, `cardId`, `grade`, `priceEur`, `note?`, `updatedAt`

**WatchlistItem**
- `id`, `cardId`, `grade?`, `targetPrice?` (für Alarme in Phase 2), `createdAt`

**FxRate** — eindeutig (date, currency)
- `date`, `currency` (gegen EUR), `rate`

**SyncRun** (für „Sync-Status")
- `id`, `startedAt`, `finishedAt?`, `cardsUpdated`, `errors?` (JSON), `status`

---

## 5. Preise & Historie

### Multi-Source-Blend
Der Tages-Job ruft **mehrere Provider** ab und lässt den `PriceResolver` pro
(Karte, Grade) den besten Wert wählen. Jeder `PriceSnapshot` speichert seine
**Herkunft** (im UI sichtbar, z. B. „Quelle: eBay-Sold").

Priorität (Standard, konfigurierbar):
1. `EbaySoldProvider` (wenn Sample-Size ausreichend) — echte PSA-Verkäufe
2. `FreeApiProvider` — Abdeckung
3. `PriceChartingProvider` (Collector-Token, falls er Daten liefert)
4. `ManualPrice` (vom Nutzer gepflegt)
→ sonst „keine Daten".

### Historie
- **Täglicher Snapshot** pro getrackter Karte/Grade ⇒ durchgehende Tageskurve (wächst ab Tag 1)
- **SaleObservations** liefern reale Datenpunkte + ermöglichen **Backfill** beim ersten Erfassen
- Allzeit-Hoch/-Tief & Trend werden aus den Snapshots/Observations berechnet

### Währung / FX
- EZB-Tageskurse (EUR-Basis) täglich laden → `FxRate`
- Pro Snapshot wird der **verwendete Kurs gespeichert** (historisch konsistente EUR-Werte)
- Anzeige: EUR primär, Originalwährung (JPY/USD) als Referenz

### PriceCharting — ausdrücklicher Vorbehalt (ToS)
- Collector ($6/Mon.) listet **keinen** API-Zugriff; CSV/„full access" sind **Legendary**-exklusiv.
- ToS reservieren Preis-Daten-Nutzung **in eigener Software** für **Legendary**.
- **Entscheidung des Nutzers:** Collector-Token wird **best-effort** getestet; die App bleibt
  **rein privat & passwortgeschützt (nicht öffentlich)**. Bei Upgrade auf Legendary wird
  `PriceChartingProvider` zur sanktionierten Primärquelle. Dies ist ein dokumentierter,
  bewusst akzeptierter Graubereich für reine Privatnutzung.

---

## 6. Seiten & Features

1. **Dashboard** (`/`) — Gesamtwert (Raw/PSA 9/PSA 10 umschaltbar), Wertentwicklungs-Chart
   der Sammlung, **Top-Mover** (Gewinner/Verlierer im Zeitraum), Anzahl + Verteilung nach Set/Rarität
2. **Galerie** (`/cards`) — Thumbnail-Grid; Filter (Set, Rarität, Variante, Kategorie, „nur meine"/alle);
   Suche (Name DE/JP/Nummer); Sortierung (Wert, 30T-Trend, Name)
3. **Karten-Detail** (`/cards/[id]`) — Slab-Bild, 3-Linien-Chart (Raw gestrichelt grau · PSA 9 hell ·
   PSA 10 gold/Fläche) + Zeitraum-Umschalter, „Mein Bestand" (Kaufpreis→Wert→G/V),
   Allzeit-Hoch/-Tief + Trend, „Letzte Verkäufe" mit Quelle, manuelles PriceCharting-Referenzfeld
4. **Watchlist** (`/watchlist`) — beobachtete, (noch) nicht besessene Karten
5. **Sammlung-hinzufügen-Flow** — Katalog-Suche → Karte wählen → Grade/Menge/Kaufpreis;
   **manuelles Anlegen** für fehlende Karten (inkl. Bild-URL) + `trackOverride`
6. **Sync-Status** (klein, Header/Settings) — letzter `SyncRun`, Provider-Status

---

## 7. Look & Feel — „Vault" (final)

Clean, dunkel, sehr leserlich, eine Akzentfarbe. Farbe kommt von den Karten-Bildern,
die UI bleibt ruhig. Design-Tokens:

- Hintergrund: `#1e1f22` · Surface: `#26272b` · Surface-2: `#2c2e33` · Border: `#ffffff12`
- Text: `#f3f4f5` · sekundär `#b0b3b8` · muted `#82858c`
- Akzent (Gold): `#d8b143`
- Chart: PSA 10 = `#d8b143` (durchgezogen, dick, Fläche) · PSA 9 = `#eef0f3` (durchgezogen) ·
  Raw = `#888c93` (gestrichelt)
- Positiv `#6ad29b` / Negativ `#e08a8a` — nur sparsam für ▲/▼
- Zahlen: `tabular-nums`, rechtsbündig in Tabellen; Raritäts-Chips monochrom (nur Rahmen)

*(Interaktive Mockups liegen unter `.superpowers/brainstorm/…`, sind aber gitignored —
daher sind die verbindlichen Tokens hier im Spec festgehalten.)*

---

## 8. Auth & Jobs

### Auth (Single-User)
- Auth.js (NextAuth) Credentials; ein einziges Konto via Env-Konfiguration.
- Alle Seiten + API hinter Login (auch nötig für ToS-Posture „nicht öffentlich").

### Cron — `/api/cron/daily` (geschützt per Secret-Header / Vercel Cron)
1. FX laden (EZB) → `FxRate` upsert
2. Für jede trackbare Karte, je Grade [raw, psa9, psa10]:
   Provider abrufen → `PriceResolver` → `PriceSnapshot` (idempotent/Tag) schreiben;
   `SaleObservation`s anhängen
3. Rate-Limits beachten (Gratis-API ~200/Tag → ggf. über mehrere Tage verteilen/priorisieren)
4. `SyncRun` protokollieren
- **Idempotent:** erneuter Lauf am selben Tag aktualisiert dieselben Zeilen.
- **Catch-up:** fehlt ein Tag, wird er beim nächsten Lauf nicht rückwirkend erfunden
  (Snapshots = Ist-Stand); Lücken sind im Chart tolerierbar.

---

## 9. MVP-Phasen

**Phase 1 (MVP)**
- Katalog-Import (JP-Spezialkarten) + `isTrackable` + `trackOverride`
- Collection-CRUD + „Mein Bestand" / G-V
- `PriceResolver` + `EbaySoldProvider` + `FreeApiProvider` + `PriceChartingProvider` (Collector-Test) + `ManualPrice`
  (eBay-Sold ist Ziel im MVP — siehe Risiko-Hinweis unten, kann nach Phase 2 rutschen)
- Täglicher Snapshot-Job + FX; Charts wachsen ab Tag 1
- Seiten: Dashboard, Galerie, Detail, Watchlist, Hinzufügen, Sync-Status
- Auth + Cloud-Deploy (Vercel + Neon)

**Phase 2**
- eBay-Sold ausbauen: Historie-Backfill + größere Abdeckung/Robustheit
- Bessere JP-Abdeckung / optional PriceCharting-Legendary als Primärquelle
- **Preis-Alarme** (Watchlist-Zielpreis), CSV-Import/Export

**Phase 3 (optional)**
- Bild-Erkennung zum Hinzufügen · PWA-Feinschliff · Mehrere Lots pro Karte/Grade

> Hinweis: `EbaySoldProvider` ist die wertvollste, aber zugriffstechnisch kniffligste Quelle
> (eBay-Sold-API ist eingeschränkt → Aggregator/Apify, evtl. kleine Kosten). Ziel ist MVP,
> kann aber nach Phase 2 rutschen, falls der Zugang aufwändig wird. Architektur ist vorbereitet.

---

## 10. Tests (TDD bei der Umsetzung)

- **Unit:** `isTrackable()`; FX-Umrechnung; Provider-Mapping & Grade-Parsing;
  `PriceResolver`-Auswahl-Logik; Snapshot-Idempotenz (1×/Tag)
- **Integration:** geschützte Cron-Route (Auth + Idempotenz); DB-Schreibpfade
- **Komponenten:** 3-Serien-Chart rendert korrekt; Galerie-Filter/Suche

---

## 11. Risiken & offene Punkte

- **eBay-Sold-Zugang:** offizielle API eingeschränkt → Aggregator/Apify/Scraper (evtl. kleine Kosten, fragiler)
- **PriceCharting Collector/ToS:** Graubereich; App bleibt privat/auth-gated; ggf. Legendary-Upgrade
- **Gratis-API JP-Abdeckung:** einzelne JP-Spezialkarten ohne Preis → „keine Daten" (verbessert sich Phase 2)
- **Historie startet ~jetzt:** Backfill nur best-effort über SaleObservations
- **Rate-Limits:** große Sammlungen brauchen Priorisierung/Verteilung des Tages-Jobs
- **Katalog-Datenquelle/Lizenz:** Daten der Community-Quellen ggf. nur eingeschränkt nutzbar → Quelle bei Umsetzung final wählen

---

## 12. Entscheidungs-Log

| Thema | Entscheidung | Grund |
|------|--------------|-------|
| Preis-Quelle | Multi-Source-Blend (eBay-Sold + Gratis-API + PriceCharting-Collector-Test + manuell), pluggable | Beste Abdeckung; sofort baubar; Upgrade-Pfad |
| Historie | Eigene Tages-Snapshots + SaleObservations | Unabhängig von Anbieter-Historie; wächst ab Tag 1 |
| Hosting | Cloud, immer erreichbar (Vercel + Neon + Cron) | „Über alle Geräte"; autonomer Tages-Job |
| Stack | Next.js + TS + Tailwind + Prisma + Recharts | Bewährt, full-stack, gut für Charts |
| Optik | „Vault" — neutrales Anthrazit-Grau + Gold, clean | Nutzer-Feedback (leserlich, wenig Farbe) |
| Karten-Bilder | Galerie mit Thumbnails; Farbe kommt von Karten | Nutzer-Wunsch |
| Special/Promo | Eigene Kategorie (z. B. BVB×Luffy), Set-Nr. optional | Collab-Promos ohne klassische Set-Nr. |
| Katalog | Lokaler Katalog aus Community-Quelle | Keine Laufzeit-Abhängigkeit |
| Währung | EUR-Anzeige via EZB; Original als Referenz | Nutzer-Wunsch |
