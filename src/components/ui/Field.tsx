import { cn } from "@/lib/cn";

const base =
  "w-full rounded-md bg-surface border border-line px-3 py-2 text-sm text-ink placeholder:text-dim focus:border-gold/60 outline-none transition-colors";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(base, className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(base, "cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("block text-[10.5px] uppercase tracking-[0.1em] text-dim mb-1", className)}>{children}</span>;
}
