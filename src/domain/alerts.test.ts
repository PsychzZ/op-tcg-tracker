import { describe, it, expect } from "vitest";
import { isAlertTriggered, distanceToTargetPct, isTargetReached } from "./alerts";

describe("isAlertTriggered", () => {
  it("fires when the price crosses down to the target", () => {
    expect(isAlertTriggered(120, 95, 100)).toBe(true);
  });

  it("fires when the price lands exactly on the target", () => {
    expect(isAlertTriggered(120, 100, 100)).toBe(true);
  });

  it("stays quiet while the price is above the target", () => {
    expect(isAlertTriggered(120, 101, 100)).toBe(false);
  });

  it("does not re-fire while the price stays below the target", () => {
    expect(isAlertTriggered(95, 90, 100)).toBe(false);
  });

  it("re-arms after a recovery: fires again on the next crossing", () => {
    // 130 → 90 fired already; then the price recovered to 130, so 130 → 99 must fire again.
    expect(isAlertTriggered(130, 99, 100)).toBe(true);
  });

  it("fires on the first price ever seen below the target", () => {
    expect(isAlertTriggered(null, 80, 100)).toBe(true);
  });

  it("does not fire when there is no previous price and the price is above the target", () => {
    expect(isAlertTriggered(null, 120, 100)).toBe(false);
  });

  it("ignores missing or non-positive targets and prices", () => {
    expect(isAlertTriggered(120, 90, 0)).toBe(false);
    expect(isAlertTriggered(120, 90, -5)).toBe(false);
    expect(isAlertTriggered(120, 0, 100)).toBe(false);
  });
});

describe("distanceToTargetPct", () => {
  it("is positive while the price is above the target", () => {
    expect(distanceToTargetPct(120, 100)).toBe(20);
  });

  it("is negative once the price is below the target", () => {
    expect(distanceToTargetPct(80, 100)).toBe(-20);
  });

  it("is null without a comparison base", () => {
    expect(distanceToTargetPct(null, 100)).toBeNull();
    expect(distanceToTargetPct(100, null)).toBeNull();
    expect(distanceToTargetPct(100, 0)).toBeNull();
    expect(distanceToTargetPct(0, 100)).toBeNull();
  });
});

describe("isTargetReached", () => {
  it("is true at or below the target", () => {
    expect(isTargetReached(100, 100)).toBe(true);
    expect(isTargetReached(90, 100)).toBe(true);
  });

  it("is false above the target or without both values", () => {
    expect(isTargetReached(101, 100)).toBe(false);
    expect(isTargetReached(null, 100)).toBe(false);
    expect(isTargetReached(100, null)).toBe(false);
  });
});
