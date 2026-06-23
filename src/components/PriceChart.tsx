"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SeriesPoint } from "@/domain/chart";

export function PriceChart({ data }: { data: SeriesPoint[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-[#82858c]">Noch keine Preis-Historie &mdash; w&auml;chst ab dem ersten Sync.</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid stroke="#ffffff10" vertical={false} />
        <XAxis dataKey="date" tick={{ fill: "#82858c", fontSize: 11 }} minTickGap={32} />
        <YAxis tick={{ fill: "#82858c", fontSize: 11 }} width={48} />
        <Tooltip contentStyle={{ background: "#26272b", border: "1px solid #ffffff20", borderRadius: 8, color: "#f3f4f5" }} />
        <Line type="monotone" dataKey="raw" name="Raw" stroke="#888c93" strokeWidth={2} strokeDasharray="6 4" dot={false} connectNulls />
        <Line type="monotone" dataKey="psa9" name="PSA 9" stroke="#eef0f3" strokeWidth={2} dot={false} connectNulls />
        <Line type="monotone" dataKey="psa10" name="PSA 10" stroke="#d8b143" strokeWidth={2.5} dot={false} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}
