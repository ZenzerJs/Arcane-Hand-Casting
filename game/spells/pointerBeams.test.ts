import { describe, expect, it } from "vitest";
import type { HandFrame, Vec3 } from "@/vision/types";
import {
  beamsOverlap,
  computeFingerBeam,
  computeHandBeams,
  fingerBolts,
  findBeamHits,
  handStackOrientation,
  segmentsIntersect,
  type Beam,
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

/** Hand with all fingertips pointing upward (negative y). */
function upwardHand(offsetX = 0): HandFrame {
  const lm = landmarks({
    // thumb
    2: [offsetX, 0],
    3: [offsetX, -1],
    4: [offsetX, -2],
    // index
    5: [offsetX + 0.05, 0],
    6: [offsetX + 0.05, -1],
    8: [offsetX + 0.05, -2],
    // middle
    9: [offsetX + 0.1, 0],
    10: [offsetX + 0.1, -1],
    12: [offsetX + 0.1, -2],
    // ring
    13: [offsetX + 0.15, 0],
    14: [offsetX + 0.15, -1],
    16: [offsetX + 0.15, -2],
    // pinky
    17: [offsetX + 0.2, 0],
    18: [offsetX + 0.2, -1],
    20: [offsetX + 0.2, -2],
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
    expect(beam.origin.y).toBeCloseTo(-2);
    expect(beam.tip.y).toBeCloseTo(-4);
  });
});

describe("segmentsIntersect", () => {
  it("true for an X crossing", () => {
    expect(
      segmentsIntersect(
        { x: 0, y: 0 },
        { x: 2, y: 2 },
        { x: 0, y: 2 },
        { x: 2, y: 0 },
      ),
    ).toBe(true);
  });

  it("false for parallel segments", () => {
    expect(
      segmentsIntersect(
        { x: 0, y: 0 },
        { x: 2, y: 0 },
        { x: 0, y: 1 },
        { x: 2, y: 1 },
      ),
    ).toBe(false);
  });
});

describe("beamsOverlap", () => {
  it("true when beams cross", () => {
    const a: Beam = {
      origin: { x: 0, y: 0 },
      tip: { x: 2, y: 2 },
      finger: 1,
    };
    const b: Beam = {
      origin: { x: 0, y: 2 },
      tip: { x: 2, y: 0 },
      finger: 1,
    };
    expect(beamsOverlap(a, b)).toBe(true);
  });

  it("true when fingertips nearly touch", () => {
    const a: Beam = {
      origin: { x: 0, y: 0 },
      tip: { x: 0, y: -2 },
      finger: 1,
    };
    const b: Beam = {
      origin: { x: 0.05, y: 0 },
      tip: { x: 0.05, y: -2 },
      finger: 1,
    };
    expect(beamsOverlap(a, b)).toBe(true);
  });
});

describe("findBeamHits", () => {
  it("finds hits when two hands have overlapping beams", () => {
    const a = upwardHand(0);
    const b = upwardHand(0.04);
    expect(findBeamHits(a, b).length).toBeGreaterThan(0);
  });

  it("returns multiple bolts when several fingertips collide", () => {
    // Identical fingertip layout → every digit nearly touches its twin.
    const a = upwardHand(0);
    const b = upwardHand(0.02);
    expect(findBeamHits(a, b).length).toBeGreaterThan(1);
  });
});

describe("fingerBolts", () => {
  it("emits exactly five bolts — one per finger", () => {
    const segs = fingerBolts(upwardHand(0), upwardHand(0.1));
    expect(segs).toHaveLength(5);
  });

  it("keeps non-zero jet length so bolts are not orbs", () => {
    const segs = fingerBolts(upwardHand(0), upwardHand(0.02));
    for (const jet of segs) {
      const len = Math.hypot(jet[1].x - jet[0].x, jet[1].y - jet[0].y);
      expect(len).toBeGreaterThan(0.1);
    }
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
