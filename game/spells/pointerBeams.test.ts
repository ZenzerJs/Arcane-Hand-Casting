import { describe, expect, it } from "vitest";
import type { HandFrame, Vec3 } from "@/vision/types";
import {
  computeFingerBeam,
  computeHandBeams,
  fingerBolts,
  handStackOrientation,
  tipReadable,
} from "./pointerBeams";

/** 21 zeroed landmarks; caller overrides the indices it cares about. */
function landmarks(overrides: Record<number, [number, number]>): Vec3[] {
  const pts: Vec3[] = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  for (const [i, [x, y]] of Object.entries(overrides)) {
    pts[Number(i)] = { x, y, z: 0 };
  }
  return pts;
}

function frame(lm: Vec3[]): HandFrame {
  return {
    id: "unknown",
    timestampMs: 0,
    landmarks: lm,
    wrist: { x: 0, y: 0 },
    palmCenter: { x: 0, y: 0 },
    indexTip: { x: lm[8].x, y: lm[8].y },
    confidence: 0.9,
    palmFacing: "toward",
    palmTowardScore: 0,
  };
}

/**
 * Hand with all fingertips pointing upward (smaller y).
 * Landmarks stay in camera-normalized 0..1 so tipReadable stays valid.
 */
function upwardHand(offsetX = 0.3): HandFrame {
  const lm = landmarks({
    // thumb
    2: [offsetX, 0.7],
    3: [offsetX, 0.55],
    4: [offsetX, 0.4],
    // index
    5: [offsetX + 0.05, 0.7],
    6: [offsetX + 0.05, 0.55],
    8: [offsetX + 0.05, 0.4],
    // middle
    9: [offsetX + 0.1, 0.7],
    10: [offsetX + 0.1, 0.55],
    12: [offsetX + 0.1, 0.4],
    // ring
    13: [offsetX + 0.15, 0.7],
    14: [offsetX + 0.15, 0.55],
    16: [offsetX + 0.15, 0.4],
    // pinky
    17: [offsetX + 0.2, 0.7],
    18: [offsetX + 0.2, 0.55],
    20: [offsetX + 0.2, 0.4],
  });
  return frame(lm);
}

describe("computeHandBeams", () => {
  it("emits five beams, one per digit", () => {
    const beams = computeHandBeams(upwardHand());
    expect(beams).toHaveLength(5);
    expect(beams.map((b) => b.finger)).toEqual([0, 1, 2, 3, 4]);
  });

  it("projects index beam along PIP→TIP", () => {
    const beam = computeFingerBeam(upwardHand(), 1, 2);
    expect(beam.origin.y).toBeCloseTo(0.4);
    // Direction is up (−y); length 2 → tip.y = 0.4 - 2.
    expect(beam.tip.y).toBeCloseTo(-1.6);
  });
});

describe("fingerBolts", () => {
  it("emits exactly five bolts — one per finger", () => {
    const segs = fingerBolts(upwardHand(0.25), upwardHand(0.55));
    expect(segs).toHaveLength(5);
    expect(segs.map((s) => s.finger)).toEqual([0, 1, 2, 3, 4]);
  });

  it("bridges matching tips left↔right as arcs", () => {
    const left = upwardHand(0.2);
    const right = upwardHand(0.55);
    const segs = fingerBolts(left, right);
    for (const bolt of segs) {
      expect(bolt.kind).toBe("arc");
      expect(bolt.from.x).toBeCloseTo(0.2 + bolt.finger * 0.05, 5);
      expect(bolt.to.x).toBeCloseTo(0.55 + bolt.finger * 0.05, 5);
    }
  });

  it("uses tip↔tip when tips are near but not collapsed", () => {
    const segs = fingerBolts(upwardHand(0.3), upwardHand(0.32));
    for (const jet of segs) {
      expect(jet.kind).toBe("arc");
      const len = Math.hypot(jet.to.x - jet.from.x, jet.to.y - jet.from.y);
      // 0.02 hand offset — real bridge, not a screen-wide beam jet.
      expect(len).toBeGreaterThan(0.015);
      expect(len).toBeLessThan(0.05);
    }
  });

  it("uses a short spark when tips collapse, not a screen-wide rod", () => {
    const a = upwardHand(0.3);
    const b = upwardHand(0.3);
    const segs = fingerBolts(a, b);
    for (const jet of segs) {
      const len = Math.hypot(jet.to.x - jet.from.x, jet.to.y - jet.from.y);
      expect(len).toBeGreaterThan(0.04);
      expect(len).toBeLessThan(0.12);
    }
  });

  it("flickers instead of bridging when a tip is unreadable", () => {
    const good = upwardHand(0.25);
    const bad = upwardHand(0.55);
    // Drive index tip into the frame edge.
    bad.landmarks[8] = { x: 0.005, y: 0.4, z: 0 };
    const segs = fingerBolts(good, bad);
    expect(segs[1].kind).toBe("flicker");
    expect(segs[0].kind).toBe("arc");
  });
});

describe("tipReadable", () => {
  it("true for extended in-frame tip", () => {
    expect(tipReadable(upwardHand(0.4), 1)).toBe(true);
  });

  it("false when tip hugs frame edge", () => {
    const hand = upwardHand(0.4);
    hand.landmarks[8] = { x: 0.01, y: 0.5, z: 0 };
    hand.landmarks[6] = { x: 0.01, y: 0.55, z: 0 };
    hand.landmarks[5] = { x: 0.01, y: 0.6, z: 0 };
    expect(tipReadable(hand, 1)).toBe(false);
  });
});

describe("handStackOrientation", () => {
  it("vertical when Δy dominates", () => {
    expect(
      handStackOrientation({ x: 0.5, y: 0.2 }, { x: 0.52, y: 0.8 }),
    ).toBe("vertical");
  });

  it("horizontal when Δx dominates", () => {
    expect(
      handStackOrientation({ x: 0.2, y: 0.5 }, { x: 0.8, y: 0.52 }),
    ).toBe("horizontal");
  });

  it("null for diagonal / equal deltas", () => {
    expect(
      handStackOrientation({ x: 0.3, y: 0.3 }, { x: 0.7, y: 0.7 }),
    ).toBeNull();
  });
});
