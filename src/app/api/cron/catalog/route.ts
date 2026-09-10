import { NextResponse } from "next/server";
import { refreshCatalog } from "@/services/catalog-refresh";
import { isAuthorizedCron } from "@/lib/cron-auth";

export const dynamic = "force-dynamic";
// One page per Japanese set, ~1.2 s apart: fine self-hosted, but on Vercel mind the function
// timeout — run the refresh from the Pi and let Vercel serve only the app.
export const maxDuration = 800;

/**
 * Scheduled catalog refresh — new sets and cards appear on PriceCharting weeks before anyone adds
 * them by hand. Protected by the same bearer secret as the price sync.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await refreshCatalog();
    return NextResponse.json({ status: "ok", ...result });
  } catch (e) {
    return NextResponse.json({ status: "error", message: String(e) }, { status: 500 });
  }
}
