import { describe, expect, it } from "vitest";
import { canCast, cooldownRemainingMs } from "./castCooldown";

describe("canCast", () => {
  it("allows the first cast", () => {
    expect(canCast(1000, -Infinity, 450)).toBe(true);
  });

  it("blocks casts inside the cooldown window", () => {
    expect(canCast(1200, 1000, 450)).toBe(false);
  });

  it("allows casts once cooldown elapses", () => {
    expect(canCast(1450, 1000, 450)).toBe(true);
  });
});

describe("cooldownRemainingMs", () => {
  it("returns remaining wait time", () => {
    expect(cooldownRemainingMs(1100, 1000, 450)).toBe(350);
  });

  it("returns zero when ready", () => {
    expect(cooldownRemainingMs(1600, 1000, 450)).toBe(0);
  });
});
