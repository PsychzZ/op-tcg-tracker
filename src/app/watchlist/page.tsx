import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getUserWatchlist } from "@/services/watchlist";
import { getLatestRawPrices } from "@/services/prices";
import { CardThumb } from "@/components/CardThumb";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { StarIcon } from "@/components/ui/icons";

export default async function WatchlistPage() {
  const user = await requireUser();
  const items = await getUserWatchlist(user.id);
  const prices = await getLatestRawPrices(items.map((w) => w.card.id));

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
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {items.map((w) => (
            <CardThumb key={w.id} card={w.card} priceEur={prices.get(w.card.id)} watched />
          ))}
        </div>
      )}
    </AppShell>
  );
}
