import Link from "next/link";
import type { Card } from "@prisma/client";
import { cardImageUrl } from "@/domain/card-image";
import { resizePcImage } from "@/domain/pricecharting-image";
import { toggleWatchAction } from "@/app/actions/watchlist";
import { CardImage } from "./CardImage";
import { PriceTag } from "./ui/PriceTag";
import { RarityBadge } from "./ui/Badge";

export function CardThumb({
  card,
  priceEur,
  watched = false,
}: {
  card: Card;
  priceEur?: number;
  watched?: boolean;
}) {
  const img = resizePcImage(card.imageUrl, 320) ?? cardImageUrl(card.number);

  return (
    <div className="group relative">
      {/* Quick add/remove to watchlist — sibling of the Link (not nested in the <a>). */}
      <form action={toggleWatchAction} className="absolute top-2 right-2 z-10">
        <input type="hidden" name="cardId" value={card.id} />
        <button
          title={watched ? "Von Watchlist entfernen" : "Zur Watchlist"}
          aria-label={watched ? "Von Watchlist entfernen" : "Zur Watchlist"}
          className={`h-7 w-7 rounded-md grid place-items-center text-sm leading-none transition
            ${
              watched
                ? "bg-gold text-vault"
                : "bg-black/55 text-ink opacity-0 group-hover:opacity-100 hover:bg-black/75 backdrop-blur-sm"
            }`}
        >
          ★
        </button>
      </form>

      <Link
        href={`/cards/${card.id}`}
        className="block rounded-xl overflow-hidden border border-line bg-surface
          transition-all duration-150 hover:border-gold/60 hover:shadow-[var(--shadow-pop)] hover:-translate-y-0.5"
      >
        <div className="aspect-[5/7] bg-raised overflow-hidden">
          <CardImage
            src={img}
            alt={card.name}
            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.06]"
          />
        </div>
        <div className="p-2.5">
          <div className="text-[12.5px] font-semibold leading-tight truncate">{card.name}</div>
          <div className="flex items-center justify-between gap-2 mt-1.5">
            <span className="flex items-center gap-1 text-[10.5px] text-dim truncate">
              {card.setCode ?? "Promo"} <RarityBadge rarity={card.rarity} />
            </span>
            {priceEur ? <PriceTag value={priceEur} className="text-[11.5px] whitespace-nowrap" /> : null}
          </div>
        </div>
      </Link>
    </div>
  );
}
