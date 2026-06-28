"use client";

import { useState } from "react";
import { PriceChart } from "./PriceChart";
import type { SeriesPoint } from "@/domain/chart";
import { cn } from "@/lib/cn";

const RANGES = [
  { d: 30, l: "30T" },
  { d: 90, l: "90T" },
  { d: 365, l: "1J" },
  { d: 0, l: "Alle" },
];

export function PriceHistory({ data }: { data: SeriesPoint[] }) {
  const [days, setDays] = useState(90);

  let filtered = data;
  if (days > 0 && data.length > 0) {
    const last = new Date(data[data.length - 1].date);
    last.setDate(last.getDate() - days);
    const cutoff = last.toISOString().slice(0, 10);
    filtered = data.filter((p) => p.date >= cutoff);
  }

  return (
    <div>
      <div className="flex gap-1 mb-3">
        {RANGES.map((r) => (
          <button
            key={r.d}
            type="button"
            onClick={() => setDays(r.d)}
            className={cn(
              "rounded-md px-2 py-1 text-xs transition-colors",
              days === r.d ? "bg-raised text-ink" : "text-dim hover:text-ink",
            )}
          >
            {r.l}
          </button>
        ))}
      </div>
      <PriceChart data={filtered} />
    </div>
  );
}
