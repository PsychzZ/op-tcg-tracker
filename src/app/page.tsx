import { requireUser } from "@/lib/session";
import { AppShell } from "@/components/AppShell";
import { getDashboard } from "@/services/dashboard";
import { formatEur } from "@/domain/money";

export default async function DashboardPage() {
  const user = await requireUser();
  const { totals, movers, distribution, count } = await getDashboard(user.id);

  const kpis = [
    { label: "Wert · Raw", value: totals.raw },
    { label: "Wert · PSA 9", value: totals.psa9 },
    { label: "Wert · PSA 10", value: totals.psa10 },
  ];

  return (
    <AppShell>
      <h1 className="text-lg font-semibold mb-4">Dashboard</h1>

      <div className="flex flex-wrap gap-3 mb-6">
        {kpis.map((k) => (
          <div key={k.label} className="flex-1 min-w-[180px] border border-white/10 rounded-[10px] bg-[#26272b] p-4">
            <div className="text-[10px] tracking-widest uppercase text-[#82858c] mb-2">{k.label}</div>
            <div className="text-2xl font-bold tabular-nums">{formatEur(k.value)}</div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <section className="border border-white/10 rounded-[10px] bg-[#26272b] p-4">
          <h2 className="text-sm font-semibold mb-3">Top-Mover (PSA 10, 30T)</h2>
          {movers.length === 0 ? (
            <p className="text-sm text-[#82858c]">Noch keine Trenddaten (brauchen ~30 Tage Historie).</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {movers.map((m) => (
                <li key={m.cardId} className="flex justify-between">
                  <a href={`/cards/${m.cardId}`} className="text-[#b0b3b8] hover:text-[#f3f4f5]">{m.name}</a>
                  <span className={m.pct >= 0 ? "text-[#6ad29b]" : "text-[#e08a8a]"}>
                    {m.pct >= 0 ? "▲" : "▼"} {m.pct}%
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border border-white/10 rounded-[10px] bg-[#26272b] p-4">
          <h2 className="text-sm font-semibold mb-3">Verteilung ({count} Karten)</h2>
          {Object.keys(distribution).length === 0 ? (
            <p className="text-sm text-[#82858c]">Deine Sammlung ist leer.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {Object.entries(distribution).map(([rarity, n]) => (
                <li key={rarity} className="flex justify-between">
                  <span className="text-[#b0b3b8]">{rarity}</span>
                  <span className="tabular-nums">{n}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}
