import { NextResponse } from "next/server";
import { runPriceSync } from "@/services/price-sync";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
// Self-hosted (Raspberry Pi) has no serverless timeout; the bulk console scrape takes a few minutes.
export const maxDuration = 800;

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await runPriceSync();
    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) }, { status: 500 });
  }
}
