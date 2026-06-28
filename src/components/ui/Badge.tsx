import { cn } from "@/lib/cn";
import type { Rarity } from "@/domain/card";

const RARITY_STYLE: Record<string, string> = {
  SEC: "border-gold/40 text-gold",
  SP: "border-gold/40 text-gold",
  SR: "border-line-strong text-muted",
  L: "border-line-strong text-muted",
};

export function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-medium leading-none", className)}>
      {children}
    </span>
  );
}

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <Badge className={cn("uppercase", RARITY_STYLE[rarity] ?? "border-line-strong text-muted")}>{rarity}</Badge>;
}
