import { cn } from "@/lib/cn";

export function Stat({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-[10.5px] uppercase tracking-[0.1em] text-dim">{label}</div>
      <div className={cn("text-lg font-bold tabular-nums mt-0.5", accent ? "text-gold" : "text-ink")}>{value}</div>
      {sub ? <div className="text-xs text-muted mt-0.5">{sub}</div> : null}
    </div>
  );
}
