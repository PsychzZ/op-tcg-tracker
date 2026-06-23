import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getUserWatchlist } from "@/services/watchlist";
import { CardThumb } from "@/components/CardThumb";

export default async function WatchlistPage() {
  const user = await requireUser();
  const items = await getUserWatchlist(user.id);

  return (
    <AppShell>
      <h1 className="text-lg font-semibold mb-4">Watchlist</h1>
      {items.length === 0 ? (
        <p className="text-[#82858c]">Noch nichts beobachtet. Füge Karten aus der Galerie hinzu.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {items.map((w) => <CardThumb key={w.id} card={w.card} />)}
        </div>
      )}
    </AppShell>
  );
}
