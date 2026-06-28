import Link from "next/link";
import type { Card, Grade } from "@prisma/client";
import { cardImageUrl } from "@/domain/card-image";
import { resizePcImage } from "@/domain/pricecharting-image";
import { CardImage } from "./CardImage";
import { Badge } from "./ui/Badge";
import { PriceTag } from "./ui/PriceTag";

const GRADE_LABEL: Record<Grade, string> = { raw: "Raw", psa9: "PSA 9", psa10: "PSA 10" };

export function CollectionCard({
  card,
  grade,
  quantity,
  valueEur,
  deltaPct,
}: {
  card: Card;
  grade: Grade;
  quantity: number;
  valueEur: number;
  deltaPct?: number | null;
}) {
  const img = resizePcImage(card.imageUrl, 320) ?? cardImageUrl(card.number);

  return (
    <Link
      href={`/cards/${card.id}`}
      className="group block rounded-xl overflow-hidden border border-line bg-surface
        transition-all duration-150 hover:border-gold/60 hover:-translate-y-0.5 hover:shadow-[var(--shadow-pop)]"
    >
      <div className="relative aspect-[5/7] bg-raised overflow-hidden">
        <CardImage
          src={img}
          alt={card.name}
          className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.06]"
        />
        {quantity > 1 && (
          <span className="absolute top-2 left-2 rounded-md bg-black/60 backdrop-blur-sm px-1.5 py-0.5 text-[10px] font-medium text-ink">
            ×{quantity}
          </span>
        )}
        <span className="absolute top-2 right-2">
          <Badge className="bg-black/60 backdrop-blur-sm border-line-strong text-ink">{GRADE_LABEL[grade]}</Badge>
        </span>
      </div>
      <div className="p-2.5">
        <div className="text-[12.5px] font-semibold truncate">{card.name}</div>
        <div className="flex items-center justify-between gap-2 mt-1.5">
          <span className="text-[10.5px] text-dim truncate">{card.setCode ?? "Promo"}</span>
          <div className="text-right">
            <PriceTag value={valueEur} className="text-[11.5px] whitespace-nowrap" />
            {deltaPct != null && (
              <div className={`text-[10px] tabular-nums ${deltaPct >= 0 ? "text-up" : "text-down"}`}>
                {deltaPct >= 0 ? "▲" : "▼"} {Math.abs(deltaPct)}%
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
