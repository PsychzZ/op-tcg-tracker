import { describe, it, expect, afterEach } from "vitest";
import { isAuthorizedCron } from "./cron-auth";

function request(authorization?: string): Request {
  return new Request("http://localhost/api/cron/daily", {
    headers: authorization ? { authorization } : {},
  });
}

const original = process.env.CRON_SECRET;

afterEach(() => {
  if (original === undefined) delete process.env.CRON_SECRET;
  else process.env.CRON_SECRET = original;
});

describe("isAuthorizedCron", () => {
  it("accepts the configured bearer token", () => {
    process.env.CRON_SECRET = "s3cret-token";
    expect(isAuthorizedCron(request("Bearer s3cret-token"))).toBe(true);
  });

  it("rejects a wrong token, a missing header and a bare secret", () => {
    process.env.CRON_SECRET = "s3cret-token";
    expect(isAuthorizedCron(request("Bearer nope"))).toBe(false);
    expect(isAuthorizedCron(request())).toBe(false);
    expect(isAuthorizedCron(request("s3cret-token"))).toBe(false);
    expect(isAuthorizedCron(request("Bearer s3cret-token-extra"))).toBe(false);
  });

  it("authorises nothing when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET;
    // The historical bug: `Bearer undefined` used to match an unset secret.
    expect(isAuthorizedCron(request("Bearer undefined"))).toBe(false);
    expect(isAuthorizedCron(request("Bearer "))).toBe(false);
    expect(isAuthorizedCron(request())).toBe(false);
  });
});
