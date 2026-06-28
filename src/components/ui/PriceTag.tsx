import { formatEur } from "@/domain/money";
import { cn } from "@/lib/cn";

export function PriceTag({
  value,
  className,
  muted = false,
}: {
  value?: number | null;
  className?: string;
  muted?: boolean;
}) {
  if (!value) return <span className={cn("tabular-nums text-dim", className)}>—</span>;
  return (
    <span className={cn("tabular-nums font-semibold", muted ? "text-muted" : "text-gold", className)}>
      {formatEur(value)}
    </span>
  );
}
