import { NextResponse } from "next/server";
import { runPriceSync } from "@/services/price-sync";

export const dynamic = "force-dynamic";
// Self-hosted (Raspberry Pi) has no serverless timeout; the bulk console scrape takes a few minutes.
export const maxDuration = 800;

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPriceSync();
    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) }, { status: 500 });
  }
}
