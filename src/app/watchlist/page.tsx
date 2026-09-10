import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getUserWatchlist } from "@/services/watchlist";
import { getLatestGradePrices } from "@/services/prices";
import { countUnseenAlerts, getUserAlerts } from "@/services/alerts";
import { CardThumb } from "@/components/CardThumb";
import { PageHeader } from "@/components/ui/PageHeader";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input, Select, Label } from "@/components/ui/Field";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarIcon } from "@/components/ui/icons";
import { distanceToTargetPct, isTargetReached } from "@/domain/alerts";
import { formatEur } from "@/domain/money";
import { setAlertTargetAction, markAlertsSeenAction } from "@/app/actions/alerts";
import type { Grade } from "@/domain/card";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];
const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };

export default async function WatchlistPage() {
  const user = await requireUser();
  const items = await getUserWatchlist(user.id);

  const [gradePrices, alerts, unseen] = await Promise.all([
    getLatestGradePrices(items.map((w) => w.card.id)),
    getUserAlerts(user.id, { take: 10 }),
    countUnseenAlerts(user.id),
  ]);

  return (
    <AppShell>
      <PageHeader title="Watchlist" subtitle="Karten, die du im Blick behältst" />

      {items.length === 0 ? (
        <EmptyState
          icon={<StarIcon />}
          title="Noch nichts beobachtet"
          description="Füge Karten aus der Galerie hinzu (Stern auf einer Karte)."
        />
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {items.map((w) => (
              <CardThumb key={w.id} card={w.card} priceEur={gradePrices.get(w.card.id)?.raw} watched />
            ))}
          </div>

          {/* Fired target-price alerts */}
          <Panel className="p-5 mt-8">
            <PanelHeader
              title="Zielpreis erreicht"
              action={
                unseen > 0 ? (
                  <form action={markAlertsSeenAction}>
                    <Button variant="outline" size="sm" type="submit">
                      Als gelesen markieren
                    </Button>
                  </form>
                ) : undefined
              }
            />
            {alerts.length === 0 ? (
              <p className="text-sm text-muted mt-3">
                Noch kein Alarm ausgelöst. Setze unten einen Zielpreis — geprüft wird er bei jedem Preis-Lauf.
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {alerts.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2.5">
                    <Link
                      href={`/cards/${a.card.id}`}
                      className="truncate text-sm text-muted transition-colors hover:text-ink"
                    >
                      {a.card.name}
                    </Link>
                    <span className="flex items-center gap-2 whitespace-nowrap text-sm tabular-nums">
                      <Badge className="border-line-strong text-dim">{GRADE_LABEL[a.grade]}</Badge>
                      <span className="text-gold">{formatEur(Number(a.priceEur))}</span>
                      <span className="text-xs text-dim">≤ {formatEur(Number(a.targetPrice))}</span>
                      <span className="text-xs text-dim">{a.snapshotDate.toISOString().slice(0, 10)}</span>
                      {a.seenAt === null && <span className="text-[10px] uppercase text-gold">neu</span>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Target-price rules */}
          <Panel className="p-5 mt-4">
            <PanelHeader title="Zielpreise" />
            <p className="text-xs text-dim mt-2">
              Jeder Zielpreis wird beim Preis-Lauf geprüft. Gemeldet wird der Moment, in dem der Preis von
              oben auf dein Ziel fällt — danach erst wieder nach einer Erholung.
            </p>
            <ul className="mt-4">
              {items.map((w) => {
                const grade: Grade = w.grade ?? "raw";
                const price = gradePrices.get(w.card.id)?.[grade] || null;
                const target = w.targetPrice ? Number(w.targetPrice) : null;
                const reached = isTargetReached(price, target);
                const distance = distanceToTargetPct(price, target);

                return (
                  <li
                    key={w.id}
                    className="flex flex-wrap items-end gap-3 border-b border-line py-3 last:border-0"
                  >
                    <div className="min-w-[10rem] flex-1">
                      <Link href={`/cards/${w.card.id}`} className="text-sm transition-colors hover:text-ink">
                        {w.card.name}
                      </Link>
                      <div className="mt-0.5 text-[11px] tabular-nums text-dim">
                        {price ? `aktuell ${formatEur(price)}` : "noch kein Preis"}
                        {reached && " · Ziel erreicht"}
                        {!reached && distance !== null && ` · ${distance}% über dem Ziel`}
                      </div>
                    </div>
                    <form action={setAlertTargetAction} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="cardId" value={w.card.id} />
                      <label className="block w-24">
                        <Label>Grade</Label>
                        <Select name="grade" defaultValue={grade}>
                          {GRADES.map((g) => (
                            <option key={g} value={g}>
                              {GRADE_LABEL[g]}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="block w-28">
                        <Label>Ziel (€)</Label>
                        <Input
                          name="targetPrice"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue={target ?? ""}
                          placeholder="kein Ziel"
                        />
                      </label>
                      <Button size="sm" type="submit">
                        Speichern
                      </Button>
                    </form>
                  </li>
                );
              })}
            </ul>
          </Panel>
        </>
      )}
    </AppShell>
  );
}
