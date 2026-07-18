import { describe, expect, it } from "vitest";
import type { HandFeatures, PerHandFeatures } from "@/vision/features";
import { selectSpell } from "./spellSelect";

function hand(openness: number): PerHandFeatures {
  return {
    id: "unknown",
    palmWidth: 0.2,
    openness,
    palmFacing: "toward",
    confidence: 0.9,
    velocity: { x: 0, y: 0, z: 0 },
    speed: 0,
    forwardVelocity: 0,
    stability: 1,
  };
}

function features(
  opennessPerHand: number[],
  palmDistance: number | null,
): HandFeatures {
  const hands = opennessPerHand.map(hand);
  return {
    handCount: hands.length,
    hands,
    palmDistance,
    meanOpenness:
      hands.reduce((s, h) => s + h.openness, 0) / (hands.length || 1),
  };
}

describe("selectSpell", () => {
  it("aegis with one open palm toward camera", () => {
    expect(
      selectSpell({
        features: features([0.9], null),
        stack: null,
        beamsOverlap: false,
      }),
    ).toBe("aegis");
  });

  it("no aegis when the single hand is closed", () => {
    expect(
      selectSpell({
        features: features([0.3], null),
        stack: null,
        beamsOverlap: false,
      }),
    ).toBeNull();
  });

  it("no aegis when palm faces away", () => {
    const f = features([0.9], null);
    f.hands[0] = { ...f.hands[0], palmFacing: "away" };
    expect(
      selectSpell({
        features: f,
        stack: null,
        beamsOverlap: false,
      }),
    ).toBeNull();
  });

  it("returns null with zero hands", () => {
    expect(
      selectSpell({
        features: features([], null),
        stack: null,
        beamsOverlap: false,
      }),
    ).toBeNull();
  });

  it("fireball when vertically stacked + open + far", () => {
    expect(
      selectSpell({
        features: features([0.8, 0.75], 1.5),
        stack: "vertical",
        beamsOverlap: false,
      }),
    ).toBe("fireball");
  });

  it("no fireball when vertical but hands closed", () => {
    expect(
      selectSpell({
        features: features([0.2, 0.1], 1.5),
        stack: "vertical",
        beamsOverlap: false,
      }),
    ).toBeNull();
  });

  it("no fireball when open hands are horizontal", () => {
    expect(
      selectSpell({
        features: features([0.9, 0.9], 1.5),
        stack: "horizontal",
        beamsOverlap: false,
      }),
    ).toBeNull();
  });

  it("lightning when horizontal + beams overlap", () => {
    expect(
      selectSpell({
        features: features([0.5, 0.5], 1.5),
        stack: "horizontal",
        beamsOverlap: true,
      }),
    ).toBe("lightning");
  });

  it("no lightning when horizontal but beams miss", () => {
    expect(
      selectSpell({
        features: features([0.5, 0.5], 1.5),
        stack: "horizontal",
        beamsOverlap: false,
      }),
    ).toBeNull();
  });

  it("no lightning when beams overlap but stack is vertical", () => {
    expect(
      selectSpell({
        features: features([0.5, 0.5], 1.5),
        stack: "vertical",
        beamsOverlap: true,
      }),
    ).toBeNull();
  });
});
