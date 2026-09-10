/**
 * Small shared HTTP helpers for the sites this app scrapes.
 *
 * Deliberately generic: the PriceCharting scrape module and the Japanese-name filler both fetch
 * plain HTML pages and both want the same "retry a couple of times, then give up quietly" behaviour.
 */

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GET a page with a few retries; returns "" when it stays unavailable, which callers treat as
 * "no data" rather than an error. Retries cover transient failures and 429 rate-limiting.
 */
export async function fetchText(url: string): Promise<string> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
      if (res.ok) return await res.text();
      if (res.status === 429) await sleep(3000);
    } catch {
      /* retry */
    }
    await sleep(1000);
  }
  return "";
}
