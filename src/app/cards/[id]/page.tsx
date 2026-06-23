import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { PriceChart } from "@/components/PriceChart";
import { getLatestPriceMap, getPriceHistory } from "@/services/prices";
import { holdingPnl } from "@/domain/valuation";
import { buildPriceSeries } from "@/domain/chart";
import { formatEur } from "@/domain/money";
import { addToCollectionAction, removeFromCollectionAction } from "@/app/actions/collection";
import { toggleWatchAction } from "@/app/actions/watchlist";
import type { Grade } from "@/domain/card";

const GRADES: Grade[] = ["raw", "psa9", "psa10"];
const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };

export default async function CardDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const card = await db.card.findUnique({ where: { id } });
  if (!card) notFound();

  const [prices, history, holdings] = await Promise.all([
    getLatestPriceMap(card.id),
    getPriceHistory(card.id),
    db.collectionItem.findMany({ where: { userId: user.id, cardId: card.id } }),
  ]);
  const series = buildPriceSeries(history);

  return (
    <AppShell>
      <div className="flex gap-6 flex-wrap">
        <div className="w-[230px] shrink-0">
          <div className="rounded-[10px] overflow-hidden border border-white/10 bg-[#2c2e33] h-[300px] flex items-center justify-center">
            {card.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.imageUrl} alt={card.name} className="h-full object-contain" />
            ) : (
              <span className="text-[#82858c] text-xs">kein Bild</span>
            )}
          </div>

          <div className="mt-3 border border-white/10 rounded-[10px] bg-[#26272b] p-3.5">
            <div className="text-[10px] tracking-widest uppercase text-[#82858c] mb-2">Mein Bestand</div>
            {holdings.length === 0 && <p className="text-sm text-[#82858c]">Noch nicht in deiner Sammlung.</p>}
            {holdings.map((h) => {
              const pnl = holdingPnl(
                { grade: h.grade, quantity: h.quantity, purchasePricePerUnit: h.purchasePricePerUnit ? Number(h.purchasePricePerUnit) : null },
                prices[h.grade] ?? 0,
              );
              return (
                <div key={h.id} className="text-sm mb-2 border-b border-white/5 pb-2">
                  <div className="flex justify-between"><span className="text-[#b0b3b8]">{GRADE_LABEL[h.grade]} ×{h.quantity}</span><span>{formatEur(pnl.value)}</span></div>
                  {pnl.pnlEur != null && (
                    <div className="flex justify-between text-xs mt-1">
                      <span className="text-[#82858c]">G/V</span>
                      <span className={pnl.pnlEur >= 0 ? "text-[#6ad29b]" : "text-[#e08a8a]"}>
                        {pnl.pnlEur >= 0 ? "▲" : "▼"} {formatEur(pnl.pnlEur)} ({pnl.pnlPct}%)
                      </span>
                    </div>
                  )}
                  <form action={removeFromCollectionAction} className="mt-1">
                    <input type="hidden" name="id" value={h.id} />
                    <input type="hidden" name="cardId" value={card.id} />
                    <button className="text-xs text-[#82858c] hover:text-[#e08a8a]">entfernen</button>
                  </form>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex-1 min-w-[300px]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold">{card.name}</h1>
              {card.nameJp && <p className="text-[#82858c] mt-1">{card.nameJp}</p>}
              <p className="text-sm text-[#82858c] mt-2">
                {card.setCode ?? "Promo"} {card.number ? `· ${card.number}` : ""} ·{" "}
                <span className="border border-white/20 rounded px-1.5">{card.rarity}</span> · 🇯🇵 Japanisch
              </p>
            </div>
            <form action={toggleWatchAction}>
              <input type="hidden" name="cardId" value={card.id} />
              <button className="text-xs text-[#d8b143] border border-[#d8b143]/50 rounded-md px-3 py-1.5 whitespace-nowrap">★ Watchlist</button>
            </form>
          </div>

          <div className="flex gap-6 mt-4 mb-3">
            {GRADES.map((g) => (
              <div key={g}>
                <div className="text-[11px] text-[#82858c]">{GRADE_LABEL[g]}</div>
                <div className="text-base font-bold tabular-nums">{prices[g] ? formatEur(prices[g]) : "—"}</div>
              </div>
            ))}
          </div>

          <div className="border border-white/10 rounded-[10px] bg-[#252629] p-4">
            <PriceChart data={series} />
          </div>

          <form action={addToCollectionAction} className="mt-5 flex flex-wrap items-end gap-2">
            <input type="hidden" name="cardId" value={card.id} />
            <label className="text-xs text-[#82858c]">Grade
              <select name="grade" className="block mt-1 rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm">
                {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABEL[g]}</option>)}
              </select>
            </label>
            <label className="text-xs text-[#82858c]">Menge
              <input name="quantity" type="number" min="1" defaultValue="1" className="block mt-1 w-20 rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm" />
            </label>
            <label className="text-xs text-[#82858c]">Kaufpreis (€)
              <input name="purchasePrice" type="number" step="0.01" className="block mt-1 w-28 rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm" />
            </label>
            <button className="rounded-md bg-[#d8b143] text-[#0e0f13] font-medium px-4 py-2 text-sm">Zur Sammlung</button>
          </form>
        </div>
      </div>
    </AppShell>
  );
}
