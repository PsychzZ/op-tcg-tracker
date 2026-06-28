# OP Vault — UI Overhaul (Vault, veredelt)

**Date:** 2026-06-27
**Status:** Approved (design); prototype-first rollout.

## Goal
Make the UI cohesive and premium across all pages, keeping the established dark-grey + gold
"Vault" aesthetic. Replace scattered arbitrary hex values with a real design-token system and a
small set of reusable components. Keep functionality, tests, and build green.

## Direction
- **Vault, refined:** dark grey + gold, card-forward, calm, lots of negative space, premium.
- **Lightweight custom components** (no shadcn/ui — avoids Next 16 / Tailwind v4 friction, full control).

## 1. Design tokens (`src/app/globals.css`, Tailwind v4 `@theme`)
Used everywhere via utilities (`bg-surface`, `text-muted`, `text-gold`, `border-line`).
- Colors: base `#1a1b1e` · surface `#232427` · raised `#2a2c30` · line `white/8` · line-strong `white/14`
  · ink `#f3f4f5` · muted `#a9adb4` · dim `#797d84` · **gold `#d8b143`** (+ gold-soft) · up `#6ad29b` · down `#e08a8a`
  · chart psa10 `#d8b143` / psa9 `#eef0f3` / raw `#888c93`.
- Fix: apply Geist font to `body` (currently overridden by Arial). Radius token `0.75rem`. Soft elevation shadow.

## 2. Component library (`src/components/ui/`)
- **Button** — variants: primary (gold), ghost, outline; sizes sm/md; works inside server-action forms.
- **Panel** — surface container, border, radius, optional padded header/title.
- **Badge** — small label; subtle rarity coding (gold-ish for SEC/SP, neutral for SR/L).
- **Stat** — label + value (dashboard, detail).
- **Field / Input / Select** — styled form controls with focus ring.
- **PriceTag** — formatted EUR, optional grade label + muted variant.

## 3. Per-page treatment
- **AppShell** — refined header (brand mark, nav with active state), max-width container, consistent padding.
- **Karten-Detail (prototype first)** — hero layout: large card image left; right: title/meta, grade price
  tiles (Raw/PSA9/PSA10), price chart, collection panel, add-to-collection form.
- **Galerie** — filter bar as a clean toolbar (rarity chips), polished card grid (already improved → on tokens).
- **Watchlist / Login / Register / Invites** — aligned to the system; centered branded auth cards.
- **Dashboard** — structure kept (it's good); restyled to tokens/components for consistency.

## 4. Rollout
1. Build token foundation + component library.
2. Fully style **Karten-Detail** as the prototype → user reviews live.
3. On approval, roll out to all remaining pages.
Tests + build stay green at every step; no functional regressions.

## Out of scope (for now)
Variant-specific card images (official list has one image per number), deploy, weekly PSA cadence.
