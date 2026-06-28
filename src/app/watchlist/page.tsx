import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getUserWatchlist } from "@/services/watchlist";
import { getLatestRawPrices } from "@/services/prices";
import { CardThumb } from "@/components/CardThumb";

export default async function WatchlistPage() {
  const user = await requireUser();
  const items = await getUserWatchlist(user.id);
  const prices = await getLatestRawPrices(items.map((w) => w.card.id));

  return (
    <AppShell>
      <h1 className="text-2xl font-bold tracking-tight mb-1">Watchlist</h1>
      <p className="text-sm text-muted mb-6">Karten, die du im Blick behältst</p>
      {items.length === 0 ? (
        <p className="text-muted">Noch nichts beobachtet. Füge Karten aus der Galerie hinzu (★ auf einer Karte).</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((w) => (
            <CardThumb key={w.id} card={w.card} priceEur={prices.get(w.card.id)} watched />
          ))}
        </div>
      )}
    </AppShell>
  );
}
