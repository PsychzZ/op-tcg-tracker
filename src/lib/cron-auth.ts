import { timingSafeEqual } from "node:crypto";

/**
 * Authorises a scheduled request against `CRON_SECRET`.
 *
 * Two properties matter here:
 *  1. an **unset** secret must never authorise anything — comparing against the literal string
 *     "Bearer undefined" would otherwise open the endpoint to anyone;
 *  2. the comparison is **constant-time**, so the token cannot be recovered byte by byte from the
 *     response timing. Different lengths short-circuit, which is unavoidable and harmless
 *     (the length of a random secret is not the secret).
 */
export function isAuthorizedCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const provided = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
