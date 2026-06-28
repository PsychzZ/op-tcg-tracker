import { officialCardImageUrl } from "@/domain/card-image";

// Proxies the official Japanese card image through our own origin so the browser never makes a
// cross-site request (which some clients block). Cached aggressively — card art never changes.
export async function GET(_req: Request, { params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const url = officialCardImageUrl(number.replace(/\.png$/i, ""));
  if (!url) return new Response("Not found", { status: 404 });

  const upstream = await fetch(url, {
    headers: {
      Referer: "https://www.onepiece-cardgame.com/",
      "User-Agent": "Mozilla/5.0",
    },
    cache: "force-cache",
  });
  if (!upstream.ok) return new Response("Not found", { status: upstream.status });

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "image/png",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
