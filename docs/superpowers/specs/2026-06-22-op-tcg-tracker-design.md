# One Piece TCG Tracker — Design / Spec

- **Datum:** 2026-06-22
- **Status:** Entwurf zur Freigabe
- **Art:** Multi-User Web-App — **privat & invite-only** (Owner + eingeladene Freunde), **nicht-kommerziell**, Cloud, immer erreichbar

---

## 1. Ziel & Kontext

Eine Web-App zum Verwalten der eigenen One-Piece-TCG-Sammlung und zum Verfolgen des
Marktwerts inkl. Preisentwicklung. **Mehrere Nutzer** (du als Owner + eingeladene Freunde)
haben jeweils eine **eigene Sammlung**; **Katalog und Preise sind geteilt** (für alle gleich).
Zugang nur per **Einladungscode** — die App ist nicht öffentlich und nicht kommerziell.

Schwerpunkt: **seltene/besondere japanische Karten** und deren Wert in den Stufen
**Raw / PSA 9 / PSA 10**, inkl. **historischer Preis-Charts**.

---

## 2. Scope

### In-Scope
- **Registrierung (per Invite-Code) + Login**, mehrere Nutzer, Rollen (Owner/Freund)
- **Pro-Nutzer-Sammlung** (jeder sieht nur seinen eigenen Bestand & Sammlungswert)
- Geteilter Karten-Katalog (nur japanische Spezialkarten) mit Bild, Set, Rarität, Variante
- Geteilte Preise je Karte in drei Stufen: **Raw, PSA 9, PSA 10**, Anzeige in **EUR**
  (Originalwährung JPY/USD als Referenz)
- Historische Preis-Charts pro Karte (Raw/PSA 9/PSA 10) + Zeiträume 30T/90T/1J/Max
- Pro-Nutzer-Dashboard: Gesamtwert, Wertentwicklung, Top-Mover, Verteilung
- Pro-Nutzer-Watchlist, Suche/Filter
- Täglicher, automatischer Preis-Aktualisierungs-Job (Cloud-Cron)

### Out-of-Scope (bewusst nicht)
- Nicht-japanische Karten (EN o. a.) — werden **nie** importiert/angezeigt
- Normale C / UC / R (ohne Spezial-Variante)
- **Öffentliche** Registrierung, **kommerzielle** Nutzung, Marktplatz/Handel, Social-Feed
- Mobile-Native-App (Web ist responsive; PWA optional später)

### Tracking-Regel (`isTrackable`)
Eine Karte wird getrackt, wenn **Sprache = Japanisch** UND mindestens eins gilt:
- Rarität ∈ { **SR, SEC, SP/Special, L (Leader)** }
- Variante ∈ { **Alt-Art, Manga/Comic, Parallel, Serial/Signed** } (egal welche Basis-Rarität)
- Kategorie = **Promo** oder **Special-Collab** (z. B. BVB×Luffy)

Ausgeschlossen: normale **C / UC / R**.
Zusätzlich **manueller Override pro Karte** (`trackOverride`). Reine, testbare Funktion
`isTrackable(card): boolean`.

---

## 3. Tech-Stack & Architektur

- **Next.js (App Router) + TypeScript** — UI + API-Routen in einem Projekt
- **Tailwind CSS** — Styling, „Vault"-Palette als Design-Tokens (siehe §7)
- **PostgreSQL** (Neon Free-Tier) via **Prisma** ORM
- **Recharts** — Charts (3-Serien-Linienchart, Flächen)
- **Vercel** — Hosting + Deploy; **Vercel Cron** für den täglichen Job
- **Auth.js (NextAuth) Credentials** — Registrierung (Invite-Code) + Login, gehashte Passwörter,
  Rollen (Owner/Freund); alle Seiten/API hinter Login

### Geteilte vs. Pro-Nutzer-Daten
- **Geteilt (global):** Card-Katalog, PriceSnapshot, SaleObservation, FxRate
- **Pro Nutzer:** CollectionItem, WatchlistItem (jeweils `userId`)

### Austauschbare Schnittstellen
- `CatalogSource` — liefert/aktualisiert Kartendaten. MVP: Import aus Community-Quelle
  (Limitless / apitcg / Datensatz) in einen **lokalen Katalog** (keine Laufzeit-Abhängigkeit).
- `PriceProvider` — liefert Preise je Karte/Grade. Aktive Implementierungen:
  - `EbaySoldProvider` — echte PSA-9/10-Verkäufe + JP (Primär für Graded-Preise & Historie)
  - `FreeApiProvider` — kostenlose API (TCG Price Lookup / JustTCG) für Abdeckung
  - *(`PriceChartingProvider` bewusst NICHT aktiv — siehe §5/ToS)*
- `PriceResolver` — wählt pro Karte/Grade die beste verfügbare Quelle (Priorität + Qualität)
  und schreibt einen **aufgelösten** Tageswert mit **Quellen-Herkunft** (provenance).

Designprinzip: kleine, klar abgegrenzte Module mit definierten Interfaces, je einzeln testbar.

---

## 4. Datenmodell (Prisma-Entities)

**User**
- `id`, `email` (unique), `passwordHash`, `displayName`
- `role` (enum: owner | friend), `createdAt`
- *Owner = via Env `OWNER_EMAIL` bestimmt; alle anderen = friend.*

**InviteCode**
- `id`, `code` (unique), `createdByUserId→User`, `note?`
- `maxUses` (default 1), `usesCount` (default 0), `expiresAt?`, `createdAt`
- *Registrierung erfordert gültigen, nicht erschöpften, nicht abgelaufenen Code.*

**Card** (geteilter Katalog)
- `id`, `name`, `nameJp`, `setCode?`, `number?`
- `rarity` (enum), `variant` (enum: normal/altArt/mangaArt/parallel/serial)
- `category` (enum: booster/starter/promo/specialCollab), `language` = `"ja"` (fix)
- `imageUrl?`, `providerIds` (JSON), `trackOverride?` · abgeleitet: `isTrackable(card)`
- `createdAt`, `updatedAt`

**CollectionItem** (Bestand **pro Nutzer**) — eindeutig (userId, cardId, grade)
- `id`, `userId→User`, `cardId→Card`, `grade` (enum: raw/psa9/psa10)
- `quantity`, `purchasePricePerUnit?`, `purchaseCurrency?`, `purchaseDate?`
- `condition?` (für raw), `notes?`
- *Mehrere Lots pro (Karte,Grade) = spätere Erweiterung.*

**PriceSnapshot** (geteilt, aufgelöster Tageswert) — eindeutig (cardId, grade, date)
- `id`, `cardId`, `grade`, `date`
- `priceNative`, `currency`, `priceEur`, `fxRate`
- `source` (enum: ebaySold/freeApi), `sampleSize?`
- *Aus diesen Zeilen entstehen die Charts; idempotent pro Tag.*

**SaleObservation** (geteilt, echte Verkäufe)
- `id`, `cardId`, `grade`, `saleDate`, `priceNative`, `currency`, `priceEur`, `source`, `url?`

**WatchlistItem** (**pro Nutzer**)
- `id`, `userId→User`, `cardId`, `grade?`, `targetPrice?` (Alarme Phase 2), `createdAt`

**FxRate** (geteilt) — eindeutig (date, currency)
- `date`, `currency` (gegen EUR), `rate`

**SyncRun** (für „Sync-Status", Owner-Sicht)
- `id`, `startedAt`, `finishedAt?`, `cardsUpdated`, `errors?` (JSON), `status`

---

## 5. Preise & Historie

### Multi-Source-Blend
Der Tages-Job ruft die aktiven Provider ab; der `PriceResolver` wählt pro (Karte, Grade)
den besten Wert und speichert die **Herkunft** (im UI sichtbar, z. B. „Quelle: eBay-Sold").

Priorität (Standard, konfigurierbar):
1. `EbaySoldProvider` (wenn Sample-Size ausreichend) — echte PSA-Verkäufe
2. `FreeApiProvider` — Abdeckung
→ sonst „keine Daten".

### Historie
- **Täglicher Snapshot** pro getrackter Karte/Grade ⇒ durchgehende Tageskurve (wächst ab Tag 1)
- **SaleObservations** liefern reale Datenpunkte + ermöglichen **Backfill** beim ersten Erfassen
- Allzeit-Hoch/-Tief & Trend aus Snapshots/Observations berechnet

### Währung / FX
- EZB-Tageskurse (EUR-Basis) täglich → `FxRate`; **verwendeter Kurs pro Snapshot gespeichert**
- Anzeige: EUR primär, Originalwährung (JPY/USD) als Referenz

### PriceCharting — bewusst NICHT in der App (ToS)
- Die App ist **Multi-User (Freunde = Dritte)**. PriceChartings ToS untersagen die Nutzung der
  Preis-Daten **in jeder Software, die Dritten zugänglich ist** — das gilt **auch für Legendary**
  (ohne Sonder-Erlaubnis).
- ⇒ Es gibt **keinen** `PriceChartingProvider` im Live-Blend. Der Owner nutzt sein Collector-Abo
  **privat & manuell** auf pricecharting.com. Das Provider-Interface bleibt erweiterbar, falls je
  eine ausdrückliche Lizenz/Erlaubnis vorliegt.
- Ebenso bei `FreeApiProvider`/`EbaySoldProvider`: vor Produktivnutzung deren ToS auf
  **nicht-kommerzielle Mehr-Nutzer-Verwendung** prüfen (siehe Risiken).

---

## 6. Seiten & Features

1. **Login / Registrierung** — Login + Registrierung **mit Invite-Code**; ohne gültigen Code keine Anmeldung
2. **Dashboard** (`/`, pro Nutzer) — Gesamtwert (Raw/PSA 9/PSA 10 umschaltbar), Wertentwicklungs-Chart,
   **Top-Mover**, Anzahl + Verteilung nach Set/Rarität
3. **Galerie** (`/cards`) — geteilter Katalog als Thumbnail-Grid; Filter (Set, Rarität, Variante, Kategorie,
   „nur meine"/alle); Suche (Name DE/JP/Nummer); Sortierung (Wert, 30T-Trend, Name)
4. **Karten-Detail** (`/cards/[id]`) — Slab-Bild, 3-Linien-Chart (Raw gestrichelt grau · PSA 9 hell ·
   PSA 10 gold/Fläche) + Zeitraum, „Mein Bestand" (Kaufpreis→Wert→G/V), Allzeit-Hoch/-Tief + Trend,
   „Letzte Verkäufe" mit Quelle
5. **Watchlist** (`/watchlist`, pro Nutzer)
6. **Sammlung-hinzufügen-Flow** — Katalog-Suche → Karte wählen → Grade/Menge/Kaufpreis;
   **manuelles Anlegen** fehlender Karten (inkl. Bild-URL) + `trackOverride`
7. **Einstellungen**
   - **Owner:** Invite-Codes generieren/verwalten, **Sync-Status** (`SyncRun`), Katalog-Sync anstoßen
   - **Alle:** Profil (Anzeigename, Passwort ändern)

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
daher sind die verbindlichen Tokens hier festgehalten.)*

---

## 8. Auth, Rollen & Jobs

### Auth & Rollen
- **Auth.js (NextAuth) Credentials**; Passwörter gehasht (bcrypt/argon2).
- **Registrierung nur mit gültigem `InviteCode`**; nach Verbrauch `usesCount++`.
- **Rollen:** `owner` (du, via `OWNER_EMAIL` geseedet) darf Invite-Codes/Katalog/Sync verwalten;
  `friend` verwaltet nur eigene Sammlung/Watchlist.
- **Daten-Isolation:** jede Abfrage auf CollectionItem/WatchlistItem ist auf `session.userId` gescoped.
- Alle Seiten + API hinter Login (kein öffentlicher Zugriff).

### Cron — `/api/cron/daily` (geschützt per Secret-Header / Vercel Cron)
1. FX laden (EZB) → `FxRate` upsert
2. Für jede trackbare Karte, je Grade [raw, psa9, psa10]:
   aktive Provider abrufen → `PriceResolver` → `PriceSnapshot` (idempotent/Tag); `SaleObservation`s anhängen
3. Rate-Limits beachten (Gratis-API ~200/Tag → ggf. über mehrere Tage verteilen/priorisieren)
4. `SyncRun` protokollieren
- **Idempotent:** erneuter Lauf am selben Tag aktualisiert dieselben Zeilen.

---

## 9. MVP-Phasen

**Phase 1 (MVP)**
- **Auth: Registrierung (Invite-Code) + Login + Rollen** (Owner/Freund), Daten-Isolation pro Nutzer
- Katalog-Import (JP-Spezialkarten) + `isTrackable` + `trackOverride`
- Collection-CRUD (pro Nutzer) + „Mein Bestand" / G-V
- `PriceResolver` + `EbaySoldProvider` + `FreeApiProvider`
  (eBay-Sold ist Ziel im MVP — siehe Risiko-Hinweis, kann nach Phase 2 rutschen)
- Täglicher Snapshot-Job + FX; Charts wachsen ab Tag 1
- Seiten: Login/Register, Dashboard, Galerie, Detail, Watchlist, Hinzufügen, Einstellungen (Invite/Sync)
- Cloud-Deploy (Vercel + Neon)

**Phase 2**
- eBay-Sold ausbauen: Historie-Backfill + größere Abdeckung/Robustheit
- Bessere JP-Abdeckung
- **Preis-Alarme** (Watchlist-Zielpreis), CSV-Import/Export

**Phase 3 (optional)**
- Bild-Erkennung zum Hinzufügen · PWA-Feinschliff · Mehrere Lots pro Karte/Grade

> Hinweis: `EbaySoldProvider` ist die wertvollste, aber zugriffstechnisch kniffligste Quelle
> (eBay-Sold-API eingeschränkt → Aggregator/Apify, evtl. kleine Kosten). Architektur ist vorbereitet.

---

## 10. Tests (TDD bei der Umsetzung)

- **Unit:** `isTrackable()`; FX-Umrechnung; Provider-Mapping & Grade-Parsing;
  `PriceResolver`-Auswahl-Logik; Snapshot-Idempotenz; Invite-Code-Validierung
- **Integration:** geschützte Cron-Route; Auth/Registrierungs-Flow; **Daten-Isolation pro Nutzer**
  (Nutzer A sieht nie Bestand von Nutzer B); Rollen-Guards (nur Owner: Invite/Sync)
- **Komponenten:** 3-Serien-Chart; Galerie-Filter/Suche

---

## 11. Risiken & offene Punkte

- **Provider-ToS bei Multi-User/Non-Profit:** `FreeApiProvider`/`EbaySoldProvider` vor Produktiv-
  nutzung auf nicht-kommerzielle Mehr-Nutzer-Verwendung prüfen; PriceCharting ist bereits ausgeschlossen
- **eBay-Sold-Zugang:** offizielle API eingeschränkt → Aggregator/Apify/Scraper (evtl. kleine Kosten, fragiler)
- **Gratis-API JP-Abdeckung:** einzelne JP-Spezialkarten ohne Preis → „keine Daten" (verbessert sich Phase 2)
- **Sicherheit/Datenschutz:** fremde Nutzerdaten (Freunde) → Passwort-Hashing, Session-Schutz,
  strikte Daten-Isolation; nur minimale personenbezogene Daten (E-Mail, Anzeigename)
- **Historie startet ~jetzt:** Backfill nur best-effort über SaleObservations
- **Rate-Limits:** große Sammlungen brauchen Priorisierung/Verteilung des Tages-Jobs
- **Katalog-Datenquelle/Lizenz:** Daten der Community-Quellen ggf. eingeschränkt nutzbar → Quelle bei Umsetzung final wählen

---

## 12. Entscheidungs-Log

| Thema | Entscheidung | Grund |
|------|--------------|-------|
| Nutzer-Modell | **Multi-User, invite-only** (Owner + Freunde), nicht-kommerziell | Wunsch: Freunde sollen mitnutzen, aber privat |
| Registrierung | **Invite-Code** | Hält es auf Freunde beschränkt, kein Pro-Person-Aufwand |
| Daten-Scope | Katalog/Preise geteilt; Sammlung/Watchlist pro Nutzer | Preise sind global gleich; Bestand ist privat |
| PriceCharting | **Nicht in der App** (ToS verbietet Dritt-zugängliche Nutzung) | Multi-User = Dritte; Owner nutzt PC privat manuell |
| Preis-Quelle | Multi-Source-Blend (eBay-Sold + Gratis-API), pluggable | Beste Abdeckung; sofort baubar |
| Historie | Eigene Tages-Snapshots + SaleObservations | Unabhängig von Anbieter-Historie; wächst ab Tag 1 |
| Hosting | Cloud, immer erreichbar (Vercel + Neon + Cron) | „Über alle Geräte"; autonomer Tages-Job |
| Stack | Next.js + TS + Tailwind + Prisma + Recharts | Bewährt, full-stack, gut für Charts |
| Optik | „Vault" — neutrales Anthrazit-Grau + Gold, clean | Nutzer-Feedback (leserlich, wenig Farbe) |
| Special/Promo | Eigene Kategorie (z. B. BVB×Luffy), Set-Nr. optional | Collab-Promos ohne klassische Set-Nr. |
| Katalog | Lokaler Katalog aus Community-Quelle | Keine Laufzeit-Abhängigkeit |
| Währung | EUR-Anzeige via EZB; Original als Referenz | Nutzer-Wunsch |
