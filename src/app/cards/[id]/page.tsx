import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";

export default async function CardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireUser();
  const { id } = await params;
  const card = await db.card.findUnique({ where: { id } });
  if (!card) notFound();

  return (
    <main className="min-h-screen bg-[#1e1f22] text-[#f3f4f5] p-8">
      <Link href="/cards" className="text-sm text-[#b0b3b8]">← Karten</Link>
      <div className="mt-4 flex gap-6">
        <div className="w-[230px] shrink-0 rounded-[10px] overflow-hidden border border-white/10 bg-[#2c2e33] h-[300px] flex items-center justify-center">
          {card.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={card.imageUrl} alt={card.name} className="h-full object-contain" />
          ) : (
            <span className="text-[#82858c] text-xs">kein Bild</span>
          )}
        </div>
        <div>
          <h1 className="text-xl font-bold">{card.name}</h1>
          {card.nameJp && <p className="text-[#82858c] mt-1">{card.nameJp}</p>}
          <p className="text-sm text-[#82858c] mt-3">
            {card.setCode ?? "Promo"} {card.number ? `· ${card.number}` : ""} ·{" "}
            <span className="border border-white/20 rounded px-1.5">{card.rarity}</span> ·{" "}
            {card.variant} · 🇯🇵 Japanisch
          </p>
          <p className="text-[#82858c] text-sm mt-6">Preis-Charts &amp; „Mein Bestand" folgen (Pläne 4–5).</p>
        </div>
      </div>
    </main>
  );
}
