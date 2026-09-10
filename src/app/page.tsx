import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { CollectionCard } from "@/components/CollectionCard";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Sparkline";
import { getDashboard } from "@/services/dashboard";
import { countUnseenAlerts, getUserAlerts } from "@/services/alerts";
import { markAlertsSeenAction } from "@/app/actions/alerts";
import { formatEur } from "@/domain/money";
import { cn } from "@/lib/cn";
import type { Grade } from "@/domain/card";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];
const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const range = sp.range === "30" || sp.range === "365" ? Number(sp.range) : 90;
  const [{ totals, movers, count, holdings, history, change30 }, unseenAlerts, unseenCount] =
    await Promise.all([
      getDashboard(user.id, range),
      getUserAlerts(user.id, { unseenOnly: true, take: 5 }),
      countUnseenAlerts(user.id),
    ]);
  const total = totals.raw + totals.psa9 + totals.psa10;
  const up = (change30.pct ?? 0) >= 0;
  const series = history.map((h) => h.value);

  return (
    <AppShell>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted mt-1">Deine Sammlung auf einen Blick</p>
      </div>

      {/* Hero: total value + 30d change + trend sparkline */}
      <Panel className="p-6 mb-4">
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="text-[11px] uppercase tracking-[0.12em] text-dim">Sammlungswert</div>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1.5">
              <div className="text-4xl font-bold tabular-nums text-gold">{formatEur(total)}</div>
              {change30.pct !== null && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold tabular-nums",
                    up ? "bg-up/12 text-up" : "bg-down/12 text-down",
                  )}
                >
                  {up ? "▲" : "▼"} {Math.abs(change30.pct)}%
                  <span className="text-dim font-normal">
                    {up ? "+" : "−"}
                    {formatEur(Math.abs(change30.eur))}
                  </span>
                </span>
              )}
            </div>
            <div className="text-sm text-muted mt-1.5">
              {count} {count === 1 ? "Position" : "Positionen"} · 30 Tage
            </div>
          </div>

          {series.length >= 2 ? (
            <div className="w-full md:w-72">
              <div className="flex justify-end gap-1 mb-1">
                {[30, 90, 365].map((d) => (
                  <Link
                    key={d}
                    href={d === 90 ? "/" : `/?range=${d}`}
                    className={cn(
                      "rounded-md px-2 py-0.5 text-[11px] transition-colors",
                      range === d ? "bg-raised text-ink" : "text-dim hover:text-ink",
                    )}
                  >
                    {d === 365 ? "1J" : `${d}T`}
                  </Link>
                ))}
              </div>
              <Sparkline data={series} id="portfolio" className="h-16 w-full" />
              <div className="mt-1 flex justify-between text-[10px] text-dim tabular-nums">
                <span>{history[0].date}</span>
                <span>{history[history.length - 1].date}</span>
              </div>
            </div>
          ) : (
            <div className="hidden md:flex w-72 h-16 items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-dim">
              Noch kein Verlauf
            </div>
          )}
        </div>
      </Panel>

      {/* Target prices that were hit since the last visit */}
      {unseenAlerts.length > 0 && (
        <Panel className="p-5 mb-6">
          <PanelHeader
            title="Zielpreis erreicht"
            action={
              <form action={markAlertsSeenAction}>
                <Button variant="outline" size="sm" type="submit">
                  Als gelesen markieren
                </Button>
              </form>
            }
          />
          <ul className="mt-4 space-y-2.5">
            {unseenAlerts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <Link
                  href={`/cards/${a.card.id}`}
                  className="text-muted hover:text-ink truncate transition-colors"
                >
                  {a.card.name}
                </Link>
                <span className="flex items-center gap-2 whitespace-nowrap tabular-nums">
                  <Badge className="border-line-strong text-dim">{GRADE_LABEL[a.grade]}</Badge>
                  <span className="text-gold">{formatEur(Number(a.priceEur))}</span>
                  <span className="text-xs text-dim">≤ {formatEur(Number(a.targetPrice))}</span>
                </span>
              </li>
            ))}
          </ul>
          {/* "Alle als gelesen" clears everything, so say how many are not listed here. */}
          {unseenCount > unseenAlerts.length && (
            <p className="mt-3 text-xs text-dim">
              +{unseenCount - unseenAlerts.length} weitere ·{" "}
              <Link href="/watchlist" className="text-muted hover:text-ink transition-colors">
                alle in der Watchlist ansehen
              </Link>
            </p>
          )}
        </Panel>
      )}

      {/* Grade breakdown with share bars */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {GRADES.map((g) => {
          const share = total > 0 ? Math.round((totals[g] / total) * 100) : 0;
          return (
            <Panel key={g} className="p-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-dim">
                  <span className="w-2 h-2 rounded-full" style={{ background: `var(--color-${g})` }} />
                  {GRADE_LABEL[g]}
                </span>
                <span className="text-[11px] text-dim tabular-nums">{share}%</span>
              </div>
              <div className="text-xl font-bold tabular-nums mt-1.5">{formatEur(totals[g])}</div>
              <div className="mt-2 h-1.5 rounded-full bg-raised overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${share}%`, background: `var(--color-${g})` }} />
              </div>
            </Panel>
          );
        })}
      </div>

      {/* Meine Sammlung — the cards themselves */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold">Meine Sammlung</h2>
        <Link href="/cards" className="text-xs text-dim hover:text-ink transition-colors">
          Karten durchstöbern →
        </Link>
      </div>

      {holdings.length === 0 ? (
        <Panel className="p-10 text-center">
          <p className="text-muted">Noch keine Karten in deiner Sammlung.</p>
          <Link href="/cards" className="inline-block mt-4">
            <Button>Karten durchstöbern</Button>
          </Link>
        </Panel>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {holdings.map((h) => (
            <CollectionCard key={h.id} card={h.card} grade={h.grade} quantity={h.quantity} valueEur={h.valueEur} deltaPct={h.deltaPct} />
          ))}
        </div>
      )}

      {/* Top movers (secondary) */}
      {movers.length > 0 && (
        <Panel className="p-5 mt-6 max-w-xl">
          <PanelHeader title="Top-Mover · PSA 10 · 30 Tage" />
          <ul className="mt-4 space-y-2.5">
            {movers.map((m) => (
              <li key={m.cardId} className="flex items-center justify-between gap-3 text-sm">
                <Link href={`/cards/${m.cardId}`} className="text-muted hover:text-ink truncate transition-colors">
                  {m.name}
                </Link>
                <span className={cn("tabular-nums font-medium whitespace-nowrap", m.pct >= 0 ? "text-up" : "text-down")}>
                  {m.pct >= 0 ? "▲" : "▼"} {Math.abs(m.pct)}%
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </AppShell>
  );
}
