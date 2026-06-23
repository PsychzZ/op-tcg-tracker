import { describe, it, expect } from "vitest";
import { isInviteUsable, type UsableInvite } from "./invite";

const NOW = new Date("2026-06-22T12:00:00Z");

function invite(o: Partial<UsableInvite> = {}): UsableInvite {
  return { usesCount: 0, maxUses: 1, expiresAt: null, ...o };
}

describe("isInviteUsable", () => {
  it("usable when uses remain and not expired", () => {
    expect(isInviteUsable(invite(), NOW)).toBe(true);
  });
  it("unusable when fully used", () => {
    expect(isInviteUsable(invite({ usesCount: 1, maxUses: 1 }), NOW)).toBe(false);
  });
  it("usable with multi-use remaining", () => {
    expect(isInviteUsable(invite({ usesCount: 2, maxUses: 5 }), NOW)).toBe(true);
  });
  it("unusable when expired", () => {
    expect(isInviteUsable(invite({ expiresAt: new Date("2026-06-01") }), NOW)).toBe(false);
  });
  it("usable when expiry is in the future", () => {
    expect(isInviteUsable(invite({ expiresAt: new Date("2026-07-01") }), NOW)).toBe(true);
  });
});
