import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { CardThumb } from "@/components/CardThumb";
import { Input, Select } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { getLatestRawPrices } from "@/services/prices";
import { resizePcImage } from "@/domain/pricecharting-image";
import { sectionFor } from "@/domain/card-set";
import { formatEur } from "@/domain/money";
import type { Prisma, Rarity, Category } from "@prisma/client";

const RARITIES: Rarity[] = ["L", "SR", "SEC", "SP"];
const SORTS: Record<string, string> = { name: "Name A–Z", price_desc: "Preis ↓", price_asc: "Preis ↑" };
const LIMIT = 200;

const CAT_SECTION: Record<Category, string> = {
  booster: "Booster-Sets",
  starter: "Starter-Decks",
  promo: "Promos",
  specialCollab: "Collabs & Specials",
};
const CAT_ORDER: Category[] = ["booster", "starter", "promo", "specialCollab"];
const BUCKET_LABEL: Record<Category, string> = {
  booster: "Sonstige",
  starter: "Sonstige Decks",
  promo: "Promos",
  specialCollab: "Collabs",
};

function SearchBar({ q }: { q?: string }) {
  return (
    <form className="flex gap-2 mb-6 max-w-xl">
      <div className="flex-1">
        <Input name="q" defaultValue={q ?? ""} placeholder="Suche über alle Sets (Name / JP / Nr.)" />
      </div>
      <Button type="submit">Suchen</Button>
    </form>
  );
}

interface SetGroup {
  key: string;
  label: string;
  href: string;
  setCode: string | null;
  category: Category;
  count: number;
  cover: string | null;
  coverPrice: number;
  total: number;
}

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rarity?: string; set?: string; cat?: string; sort?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const browsing = Boolean(sp.q || sp.rarity || sp.set || sp.cat);

  // ---- Landing: browse by set, grouped by category, with art covers + set value ----
  if (!browsing) {
    const rows = await db.card.findMany({ select: { id: true, setCode: true, category: true, imageUrl: true } });
    const prices = await getLatestRawPrices(rows.map((r) => r.id));

    const groups = new Map<string, SetGroup>();
    for (const r of rows) {
      const price = prices.get(r.id) ?? 0;
      const key = r.setCode ?? `cat:${r.category}`;
      const g =
        groups.get(key) ??
        ({
          key,
          label: r.setCode ?? BUCKET_LABEL[r.category],
          href: r.setCode ? `/cards?set=${encodeURIComponent(r.setCode)}` : `/cards?cat=${r.category}`,
          setCode: r.setCode,
          category: r.category,
          count: 0,
          cover: null,
          coverPrice: -1,
          total: 0,
        } satisfies SetGroup);
      g.count++;
      g.total += price;
      if (r.imageUrl && price > g.coverPrice) {
        g.cover = r.imageUrl;
        g.coverPrice = price;
      }
      groups.set(key, g);
    }

    const sections = CAT_ORDER.map((cat) => ({
      cat,
      title: CAT_SECTION[cat],
      sets: [...groups.values()]
        .filter((g) => sectionFor(g.setCode, g.category) === cat)
        .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })),
    })).filter((s) => s.sets.length > 0);

    return (
      <AppShell>
        <div className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Karten</h1>
          <p className="text-sm text-muted mt-1">Wähle ein Set – oder suche direkt über alle.</p>
        </div>
        <SearchBar q={sp.q} />

        <div className="flex items-center justify-end mb-3">
          <Link href="/cards?cat=all" className="text-xs text-dim hover:text-ink transition-colors">
            Alle Karten ansehen →
          </Link>
        </div>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.cat}>
              <h2 className="text-sm font-semibold text-muted mb-3">
                {section.title} <span className="text-dim font-normal">· {section.sets.length}</span>
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {section.sets.map((s) => (
                  <Link
                    key={s.key}
                    href={s.href}
                    className="group relative aspect-[3/4] rounded-xl overflow-hidden border border-line bg-surface
                      transition-all duration-150 hover:border-gold/60 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
                  >
                    {s.cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resizePcImage(s.cover, 320) ?? undefined}
                        alt=""
                        loading="lazy"
                        className="absolute inset-0 h-full w-full object-cover object-top
                          transition-transform duration-200 group-hover:scale-[1.05]"
                      />
                    ) : (
                      <div className="absolute inset-0 grid place-items-center text-3xl text-dim">★</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-vault via-vault/55 to-transparent" />
                    <div className="absolute bottom-0 inset-x-0 p-3">
                      <div className="font-bold tracking-tight leading-tight">{s.label}</div>
                      <div className="flex items-center justify-between gap-2 text-[11px] mt-0.5">
                        <span className="text-muted">{s.count} Karten</span>
                        {s.total > 0 && <span className="text-gold tabular-nums">{formatEur(s.total)}</span>}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </AppShell>
    );
  }

  // ---- Browsing: filtered cards ----
  const where: Prisma.CardWhereInput = {};
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { nameJp: { contains: sp.q } },
      { number: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (sp.rarity) where.rarity = sp.rarity as Rarity;
  if (sp.set) where.setCode = sp.set;
  if (sp.cat && sp.cat !== "all") where.category = sp.cat as Category;

  const [cards, watch] = await Promise.all([
    db.card.findMany({ where, orderBy: { name: "asc" } }),
    db.watchlistItem.findMany({ where: { userId: user.id }, select: { cardId: true } }),
  ]);
  const prices = await getLatestRawPrices(cards.map((c) => c.id));
  const watchedSet = new Set(watch.map((w) => w.cardId));

  // Sort the full result BEFORE limiting, so price order is correct across the whole set.
  let sorted = cards;
  if (sp.sort === "price_desc") sorted = [...cards].sort((a, b) => (prices.get(b.id) ?? 0) - (prices.get(a.id) ?? 0));
  else if (sp.sort === "price_asc") sorted = [...cards].sort((a, b) => (prices.get(a.id) ?? 0) - (prices.get(b.id) ?? 0));
  const list = sorted.slice(0, LIMIT);
  const truncated = sorted.length > LIMIT;

  const catTitle = sp.cat && sp.cat !== "all" ? CAT_SECTION[sp.cat as Category] : "Alle Karten";
  const title = sp.q ? `Suche: „${sp.q}"` : sp.set ? sp.set : catTitle;

  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (sp.q) p.set("q", sp.q);
    if (sp.set) p.set("set", sp.set);
    if (sp.cat) p.set("cat", sp.cat);
    if (sp.rarity) p.set("rarity", sp.rarity);
    if (sp.sort) p.set("sort", sp.sort);
    for (const [k, v] of Object.entries(extra)) v ? p.set(k, v) : p.delete(k);
    return `/cards?${p.toString()}`;
  };

  return (
    <AppShell>
      <div className="flex items-end justify-between flex-wrap gap-3 mb-1">
        <Link href="/cards" className="text-xs text-dim hover:text-ink transition-colors">
          ← Sets
        </Link>
        <span className="text-xs text-dim tabular-nums">
          {sorted.length} Karten{truncated ? ` · zeige ${LIMIT}` : ""}
        </span>
      </div>
      <h1 className="text-2xl font-bold tracking-tight mb-4">{title}</h1>

      <form className="flex flex-wrap items-end gap-2 mb-6">
        {sp.set ? <input type="hidden" name="set" value={sp.set} /> : null}
        {sp.cat ? <input type="hidden" name="cat" value={sp.cat} /> : null}
        <div className="flex-1 min-w-[180px]">
          <Input name="q" defaultValue={sp.q ?? ""} placeholder="Suche (Name / JP / Nr.)" />
        </div>
        <div className="w-36">
          <Select name="rarity" defaultValue={sp.rarity ?? ""}>
            <option value="">Alle Raritäten</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select name="sort" defaultValue={sp.sort ?? "name"}>
            {Object.entries(SORTS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <Button type="submit">Filtern</Button>
      </form>

      {list.length === 0 ? (
        <p className="text-muted">
          Keine Karten gefunden.{" "}
          <Link href={keep({ q: "", rarity: "" })} className="text-gold">
            Filter zurücksetzen
          </Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {list.map((c) => (
            <CardThumb key={c.id} card={c} priceEur={prices.get(c.id)} watched={watchedSet.has(c.id)} />
          ))}
        </div>
      )}
    </AppShell>
  );
}
