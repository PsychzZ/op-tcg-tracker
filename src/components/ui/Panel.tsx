import { cn } from "@/lib/cn";

export function Panel({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("rounded-xl border border-line bg-surface shadow-[var(--shadow-panel)]", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function PanelHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="text-[11px] font-medium tracking-[0.14em] uppercase text-dim">{title}</h2>
      {action}
    </div>
  );
}
