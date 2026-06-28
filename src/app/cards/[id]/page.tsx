import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { PriceHistory } from "@/components/PriceHistory";
import { CardImage } from "@/components/CardImage";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge, RarityBadge } from "@/components/ui/Badge";
import { Input, Select, Label } from "@/components/ui/Field";
import { getLatestPriceMap, getPriceHistory } from "@/services/prices";
import { gradeDeltas } from "@/domain/movers";
import { holdingPnl } from "@/domain/valuation";
import { buildPriceSeries } from "@/domain/chart";
import { cardImageUrl } from "@/domain/card-image";
import { formatEur } from "@/domain/money";
import { cn } from "@/lib/cn";
import { addToCollectionAction, removeFromCollectionAction } from "@/app/actions/collection";
import { toggleWatchAction } from "@/app/actions/watchlist";
import type { Grade } from "@/domain/card";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];
const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };
const GRADE_VALUE_CLS: Record<Grade, string> = { raw: "text-muted", psa9: "text-ink", psa10: "text-gold" };
const VARIANT_LABEL: Record<string, string> = {
  altArt: "Alt Art",
  mangaArt: "Manga",
  parallel: "Parallel",
  serial: "Serial",
};

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const card = await db.card.findUnique({ where: { id } });
  if (!card) notFound();

  const [prices, history, holdings, watched] = await Promise.all([
    getLatestPriceMap(card.id),
    getPriceHistory(card.id),
    db.collectionItem.findMany({ where: { userId: user.id, cardId: card.id } }),
    db.watchlistItem.findFirst({ where: { userId: user.id, cardId: card.id } }),
  ]);
  const series = buildPriceSeries(history);
  const deltas = gradeDeltas(history, 30);

  return (
    <AppShell>
      <Link href="/cards" className="text-xs text-dim hover:text-ink transition-colors">← Karten</Link>

      <div className="mt-4 grid lg:grid-cols-[300px_1fr] gap-8">
        {/* LEFT: image + holdings */}
        <div className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Panel className="overflow-hidden">
            <div className="aspect-[5/7] bg-raised">
              <CardImage
                src={card.imageUrl ?? cardImageUrl(card.number)}
                alt={card.name}
                className="h-full w-full object-cover"
              />
            </div>
          </Panel>

          <Panel className="p-4">
            <PanelHeader title="Mein Bestand" />
            <div className="mt-3 space-y-2">
              {holdings.length === 0 && <p className="text-sm text-muted">Noch nicht in deiner Sammlung.</p>}
              {holdings.map((h) => {
                const pnl = holdingPnl(
                  {
                    grade: h.grade,
                    quantity: h.quantity,
                    purchasePricePerUnit: h.purchasePricePerUnit ? Number(h.purchasePricePerUnit) : null,
                  },
                  prices[h.grade] ?? 0,
                );
                return (
                  <div key={h.id} className="text-sm border-b border-line pb-2 last:border-0">
                    <div className="flex justify-between">
                      <span className="text-muted">{GRADE_LABEL[h.grade]} ×{h.quantity}</span>
                      <span className="tabular-nums">{formatEur(pnl.value)}</span>
                    </div>
                    {pnl.pnlEur != null && (
                      <div className="flex justify-between text-xs mt-1">
                        <span className="text-dim">G/V</span>
                        <span className={cn("tabular-nums", pnl.pnlEur >= 0 ? "text-up" : "text-down")}>
                          {pnl.pnlEur >= 0 ? "▲" : "▼"} {formatEur(pnl.pnlEur)} ({pnl.pnlPct}%)
                        </span>
                      </div>
                    )}
                    <form action={removeFromCollectionAction} className="mt-1">
                      <input type="hidden" name="id" value={h.id} />
                      <input type="hidden" name="cardId" value={card.id} />
                      <button className="text-xs text-dim hover:text-down transition-colors">entfernen</button>
                    </form>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        {/* RIGHT: info, prices, chart, add form */}
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">{card.name}</h1>
              {card.nameJp && <p className="text-muted mt-1">{card.nameJp}</p>}
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted mt-2.5">
                <span>
                  {card.setCode ?? "Promo"}
                  {card.number ? ` · ${card.number}` : ""}
                </span>
                <RarityBadge rarity={card.rarity} />
                {VARIANT_LABEL[card.variant] && <Badge className="border-line-strong text-muted">{VARIANT_LABEL[card.variant]}</Badge>}
                <Badge className="border-line-strong text-dim">JP</Badge>
              </div>
            </div>
            <form action={toggleWatchAction}>
              <input type="hidden" name="cardId" value={card.id} />
              <Button variant={watched ? "primary" : "outline"} size="sm" className="whitespace-nowrap">
                {watched ? "★ Beobachtet" : "☆ Watchlist"}
              </Button>
            </form>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {GRADES.map((g) => (
              <Panel key={g} className="px-3.5 py-3">
                <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.1em] text-dim">
                  <span className="w-2 h-2 rounded-full" style={{ background: `var(--color-${g})` }} />
                  {GRADE_LABEL[g]}
                </div>
                <div className={cn("text-xl font-bold tabular-nums mt-1.5", GRADE_VALUE_CLS[g])}>
                  {prices[g] ? formatEur(prices[g]) : "—"}
                </div>
                {deltas[g] !== null && (
                  <div className={cn("text-[11px] tabular-nums mt-0.5", deltas[g]! >= 0 ? "text-up" : "text-down")}>
                    {deltas[g]! >= 0 ? "▲" : "▼"} {Math.abs(deltas[g]!)}% · 30T
                  </div>
                )}
              </Panel>
            ))}
          </div>

          <Panel className="p-4">
            <PanelHeader title="Preisverlauf" />
            <div className="mt-3">
              <PriceHistory data={series} />
            </div>
          </Panel>

          <Panel className="p-4">
            <PanelHeader title="Zur Sammlung hinzufügen" />
            <form action={addToCollectionAction} className="mt-3 flex flex-wrap items-end gap-3">
              <input type="hidden" name="cardId" value={card.id} />
              <label className="block w-28">
                <Label>Grade</Label>
                <Select name="grade">
                  {GRADES.map((g) => (
                    <option key={g} value={g}>{GRADE_LABEL[g]}</option>
                  ))}
                </Select>
              </label>
              <label className="block w-20">
                <Label>Menge</Label>
                <Input name="quantity" type="number" min="1" defaultValue="1" />
              </label>
              <label className="block w-32">
                <Label>Kaufpreis (€)</Label>
                <Input name="purchasePrice" type="number" step="0.01" />
              </label>
              <Button type="submit">Hinzufügen</Button>
            </form>
          </Panel>
        </div>
      </div>
    </AppShell>
  );
}
