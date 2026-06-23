import { requireUser } from "@/lib/session";
import { db } from "@/lib/db";
import { CardThumb } from "@/components/CardThumb";
import type { Prisma, Rarity } from "@prisma/client";

const RARITIES: Rarity[] = ["SR", "SEC", "SP", "L"];

export default async function CardsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rarity?: string; set?: string }>;
}) {
  await requireUser();
  const sp = await searchParams;

  const where: Prisma.CardWhereInput = {};
  if (sp.q) {
    where.OR = [
      { name: { contains: sp.q, mode: "insensitive" } },
      { nameJp: { contains: sp.q } },
      { number: { contains: sp.q, mode: "insensitive" } },
    ];
  }
  if (sp.rarity) where.rarity = sp.rarity as Rarity;
  if (sp.set) where.setCode = sp.set;

  const cards = await db.card.findMany({ where, orderBy: { name: "asc" }, take: 200 });

  return (
    <main className="min-h-screen bg-[#1e1f22] text-[#f3f4f5] p-8">
      <h1 className="text-lg font-semibold mb-4">Karten</h1>
      <form className="flex flex-wrap gap-2 mb-6">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Suche (Name / JP / Nr.)"
          className="rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm"
        />
        <select name="rarity" defaultValue={sp.rarity ?? ""} className="rounded-md bg-[#26272b] border border-white/10 px-3 py-2 text-sm">
          <option value="">Alle Raritäten</option>
          {RARITIES.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button className="rounded-md bg-[#d8b143] text-[#0e0f13] font-medium px-4 text-sm">Filtern</button>
      </form>

      {cards.length === 0 ? (
        <p className="text-[#82858c]">Keine Karten. Führe <code>npm run import:catalog</code> aus.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {cards.map((c) => (
            <CardThumb key={c.id} card={c} />
          ))}
        </div>
      )}
    </main>
  );
}
