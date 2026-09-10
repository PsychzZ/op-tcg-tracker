import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Input, Label } from "@/components/ui/Field";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { getUserCollection } from "@/services/collection";
import { getLatestGradePrices } from "@/services/prices";
import { getRealizedTotals, getUserSales } from "@/services/sales";
import { realizedPnl } from "@/domain/sale";
import { formatEur } from "@/domain/money";
import { recordSaleAction } from "@/app/actions/sales";
import { cn } from "@/lib/cn";
import type { Grade } from "@/domain/card";

const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };
const TODAY = () => new Date().toISOString().slice(0, 10);

export default async function SalesPage() {
  const user = await requireUser();
  const [holdings, sales, totals] = await Promise.all([
    getUserCollection(user.id),
    getUserSales(user.id),
    getRealizedTotals(user.id),
  ]);
  const prices = await getLatestGradePrices(holdings.map((h) => h.cardId));

  return (
    <AppShell>
      <PageHeader title="Verkäufe" subtitle="Verkaufte Karten und der tatsächlich realisierte Gewinn" />

      {/* Realized totals */}
      <Panel className="p-6 mb-6">
        <div className="text-[11px] uppercase tracking-[0.12em] text-dim">Realisierter Gewinn/Verlust</div>
        <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <div
            className={cn(
              "text-4xl font-bold tabular-nums",
              totals.count === 0 ? "text-muted" : totals.pnlEur >= 0 ? "text-up" : "text-down",
            )}
          >
            {totals.count === 0
              ? "—"
              : `${totals.pnlEur >= 0 ? "+" : "−"}${formatEur(Math.abs(totals.pnlEur))}`}
          </div>
          {totals.count > 0 && totals.pnlPct !== null && (
            <span className="text-sm text-muted tabular-nums">
              {totals.pnlPct >= 0 ? "▲" : "▼"} {Math.abs(totals.pnlPct)}%
            </span>
          )}
        </div>
        <div className="text-sm text-muted mt-1.5">
          {totals.count} {totals.count === 1 ? "Verkauf" : "Verkäufe"} · {totals.units} Karten · Erlös{" "}
          {formatEur(totals.proceeds)}
          {totals.fees > 0 && ` · Gebühren ${formatEur(totals.fees)}`}
        </div>
        {totals.unknownCostCount > 0 && (
          <p className="text-xs text-dim mt-1.5">
            {totals.unknownCostCount === 1
              ? "1 Verkauf hat keinen Kaufpreis"
              : `${totals.unknownCostCount} Verkäufe haben keinen Kaufpreis`}{" "}
            — sie zählen nicht in den Gewinn.
          </p>
        )}
      </Panel>

      {/* Sell a holding */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Karte verkaufen</h2>
        <Link href="/cards" className="text-xs text-dim hover:text-ink transition-colors">
          Karten durchstöbern →
        </Link>
      </div>

      {holdings.length === 0 ? (
        <Panel className="p-8 text-center">
          <p className="text-muted">Keine Karten im Bestand — es gibt nichts zu verkaufen.</p>
        </Panel>
      ) : (
        <Panel className="p-5">
          <ul>
            {holdings.map((h) => {
              const price = prices.get(h.cardId)?.[h.grade] ?? null;
              const costBasis = h.purchasePricePerUnit ? Number(h.purchasePricePerUnit) : null;
              return (
                <li
                  key={h.id}
                  className="flex flex-wrap items-end gap-3 border-b border-line py-3 first:pt-0 last:border-0 last:pb-0"
                >
                  <div className="min-w-[12rem] flex-1">
                    <Link href={`/cards/${h.cardId}`} className="text-sm transition-colors hover:text-ink">
                      {h.card.name}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] tabular-nums text-dim">
                      <Badge className="border-line-strong text-dim">{GRADE_LABEL[h.grade]}</Badge>
                      <span>
                        Bestand {h.quantity}
                        {costBasis !== null && ` · Einkauf ${formatEur(costBasis)}`}
                        {price !== null && ` · aktuell ${formatEur(price)}`}
                      </span>
                    </div>
                  </div>
                  <form action={recordSaleAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="cardId" value={h.cardId} />
                    <input type="hidden" name="grade" value={h.grade} />
                    <label className="block w-20">
                      <Label>Menge</Label>
                      <Input name="quantity" type="number" min="1" max={h.quantity} defaultValue="1" />
                    </label>
                    <label className="block w-28">
                      <Label>Preis/Stk. (€)</Label>
                      <Input
                        name="soldPrice"
                        type="number"
                        step="0.01"
                        min="0"
                        defaultValue={price !== null ? price.toFixed(2) : undefined}
                      />
                    </label>
                    <label className="block w-24">
                      <Label>Gebühren (€)</Label>
                      <Input name="fees" type="number" step="0.01" min="0" placeholder="0" />
                    </label>
                    <label className="block w-36">
                      <Label>Datum</Label>
                      <Input name="soldAt" type="date" defaultValue={TODAY()} />
                    </label>
                    <Button size="sm" type="submit">
                      Verkaufen
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {/* Sale history */}
      <div className="flex items-center justify-between mb-3 mt-8">
        <h2 className="text-base font-semibold">Verkaufsverlauf</h2>
      </div>

      {sales.length === 0 ? (
        <EmptyState
          icon={<Badge className="border-line-strong text-dim">€</Badge>}
          title="Noch nichts verkauft"
          description="Erfasste Verkäufe erscheinen hier mit Erlös und realisiertem Gewinn."
        />
      ) : (
        <Panel className="p-5">
          <PanelHeader title={`${sales.length} ${sales.length === 1 ? "Verkauf" : "Verkäufe"}`} />
          <ul className="mt-4">
            {sales.map((s) => {
              const pnl = realizedPnl({
                quantity: s.quantity,
                soldPricePerUnit: Number(s.soldPricePerUnit),
                feesEur: s.fees === null ? null : Number(s.fees),
                costBasisPerUnit: s.costBasisPerUnit === null ? null : Number(s.costBasisPerUnit),
              });
              return (
                <li
                  key={s.id}
                  className="flex flex-wrap items-center justify-between gap-3 border-b border-line py-2.5 last:border-0"
                >
                  <span className="min-w-[10rem] flex-1 truncate text-sm">
                    <Link href={`/cards/${s.card.id}`} className="text-muted transition-colors hover:text-ink">
                      {s.card.name}
                    </Link>
                  </span>
                  <span className="flex flex-wrap items-center gap-2 whitespace-nowrap text-xs tabular-nums text-dim">
                    <span>{s.soldAt.toISOString().slice(0, 10)}</span>
                    <Badge className="border-line-strong text-dim">{GRADE_LABEL[s.grade]}</Badge>
                    <span>×{s.quantity}</span>
                    <span className="text-ink">{formatEur(Number(s.soldPricePerUnit))}</span>
                    {pnl.fees > 0 && <span>− {formatEur(pnl.fees)} Geb.</span>}
                    {pnl.pnlEur !== null ? (
                      <span className={cn("font-medium", pnl.pnlEur >= 0 ? "text-up" : "text-down")}>
                        {pnl.pnlEur >= 0 ? "▲" : "▼"} {formatEur(pnl.pnlEur)}
                        {pnl.pnlPct !== null && ` (${pnl.pnlPct}%)`}
                      </span>
                    ) : (
                      <span className="text-dim">ohne Kaufpreis</span>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}
    </AppShell>
  );
}
