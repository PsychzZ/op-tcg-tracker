import Link from "next/link";
import type { Card } from "@prisma/client";

export function CardThumb({ card }: { card: Card }) {
  return (
    <Link
      href={`/cards/${card.id}`}
      className="block rounded-[10px] overflow-hidden border border-white/10 bg-[#26272b] hover:border-[#d8b143]/50 transition-colors"
    >
      <div className="h-[150px] bg-[#2c2e33] flex items-center justify-center">
        {card.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={card.imageUrl} alt={card.name} className="h-full object-contain" />
        ) : (
          <span className="text-[#82858c] text-xs">kein Bild</span>
        )}
      </div>
      <div className="p-2.5">
        <div className="text-[12.5px] font-semibold leading-tight truncate">{card.name}</div>
        <div className="text-[10.5px] text-[#82858c] mt-1">
          {card.setCode ?? "Promo"} ·{" "}
          <span className="border border-white/20 rounded px-1">{card.rarity}</span>
        </div>
      </div>
    </Link>
  );
}
