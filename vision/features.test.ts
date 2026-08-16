import { describe, expect, it } from "vitest";
import {
  clamp,
  extractFeatures,
  FeatureExtractor,
  fingerExtension,
  measureFingerExtensions,
  measureNormalizedPalmDistance,
  measureOpenness,
  measurePalmWidth,
} from "./features";
import type { HandFrame, VisionFrame } from "./types";

function point(x: number, y: number, z = 0) {
  return { x, y, z };
}

/** Build 21 landmarks; unspecified indices default to origin. */
function landmarksFrom(
  overrides: Partial<Record<number, { x: number; y: number; z?: number }>>,
) {
  return Array.from({ length: 21 }, (_, i) => {
    const o = overrides[i];
    return o ? point(o.x, o.y, o.z ?? 0) : point(0, 0, 0);
  });
}

function makeHand(
  partial: Partial<HandFrame> & { landmarks: HandFrame["landmarks"] },
): HandFrame {
  return {
    id: "right",
    timestampMs: 0,
    wrist: { x: partial.landmarks[0].x, y: partial.landmarks[0].y },
    palmCenter: { x: 0.5, y: 0.5 },
    indexTip: { x: partial.landmarks[8].x, y: partial.landmarks[8].y },
    confidence: 0.9,
    palmFacing: "toward",
    palmTowardScore: 0.5,
    ...partial,
  };
}

describe("clamp", () => {
  it("limits values to the inclusive range", () => {
    expect(clamp(2, 0, 1)).toBe(1);
    expect(clamp(-1, 0, 1)).toBe(0);
    expect(clamp(0.4, 0, 1)).toBe(0.4);
  });
});

describe("measurePalmWidth", () => {
  it("measures index MCP to pinky MCP distance", () => {
    const landmarks = landmarksFrom({
      5: { x: 0, y: 0 },
      17: { x: 3, y: 4 },
    });
    expect(measurePalmWidth(landmarks)).toBe(5);
  });
});

describe("fingerExtension", () => {
  it("is near 1 when MCP→PIP→tip is straight", () => {
    // PIP in the middle; MCP left, tip right → opposite vectors from PIP.
    const score = fingerExtension(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    );
    expect(score).toBeCloseTo(1, 5);
  });

  it("is near 0 when the tip folds back toward the MCP", () => {
    // Tip on the same side of PIP as MCP → curled.
    const score = fingerExtension(
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.2, y: 0 },
    );
    expect(score).toBeLessThan(0.2);
  });
});

describe("measureOpenness", () => {
  it("scores an open-ish synthetic hand higher than a curled one", () => {
    const open = landmarksFrom({
      2: { x: 0.1, y: 0.5 },
      3: { x: 0.05, y: 0.4 },
      4: { x: 0.0, y: 0.3 },
      5: { x: 0.3, y: 0.5 },
      6: { x: 0.3, y: 0.35 },
      8: { x: 0.3, y: 0.15 },
      9: { x: 0.4, y: 0.5 },
      10: { x: 0.4, y: 0.35 },
      12: { x: 0.4, y: 0.15 },
      13: { x: 0.5, y: 0.5 },
      14: { x: 0.5, y: 0.35 },
      16: { x: 0.5, y: 0.15 },
      17: { x: 0.6, y: 0.5 },
      18: { x: 0.6, y: 0.35 },
      20: { x: 0.6, y: 0.15 },
    });

    // Curled: PIP out from MCP, tip folded back toward MCP (same side of PIP).
    const fist = landmarksFrom({
      2: { x: 0.45, y: 0.5 },
      3: { x: 0.35, y: 0.45 },
      4: { x: 0.42, y: 0.48 },
      5: { x: 0.3, y: 0.5 },
      6: { x: 0.3, y: 0.35 },
      8: { x: 0.3, y: 0.48 },
      9: { x: 0.4, y: 0.5 },
      10: { x: 0.4, y: 0.35 },
      12: { x: 0.4, y: 0.48 },
      13: { x: 0.5, y: 0.5 },
      14: { x: 0.5, y: 0.35 },
      16: { x: 0.5, y: 0.48 },
      17: { x: 0.6, y: 0.5 },
      18: { x: 0.6, y: 0.35 },
      20: { x: 0.6, y: 0.48 },
    });

    expect(measureOpenness(open)).toBeGreaterThan(measureOpenness(fist));
  });
});

describe("measureFingerExtensions", () => {
  it("returns one extension per finger, matching the openness mean", () => {
    const landmarks = landmarksFrom({
      2: { x: 0.1, y: 0.5 },
      3: { x: 0.05, y: 0.4 },
      4: { x: 0.0, y: 0.3 },
      5: { x: 0.3, y: 0.5 },
      6: { x: 0.3, y: 0.35 },
      8: { x: 0.3, y: 0.15 },
      9: { x: 0.4, y: 0.5 },
      10: { x: 0.4, y: 0.35 },
      12: { x: 0.4, y: 0.15 },
      13: { x: 0.5, y: 0.5 },
      14: { x: 0.5, y: 0.35 },
      16: { x: 0.5, y: 0.15 },
      17: { x: 0.6, y: 0.5 },
      18: { x: 0.6, y: 0.35 },
      20: { x: 0.6, y: 0.15 },
    });
    const extensions = measureFingerExtensions(landmarks);
    expect(extensions).toHaveLength(5);
    const mean =
      extensions.reduce((sum, value) => sum + value, 0) / extensions.length;
    expect(measureOpenness(landmarks)).toBeCloseTo(mean, 5);
  });
});

describe("measureNormalizedPalmDistance", () => {
  it("divides raw palm distance by average palm width", () => {
    const a = makeHand({
      landmarks: landmarksFrom({
        5: { x: 0, y: 0 },
        17: { x: 0.2, y: 0 },
      }),
      palmCenter: { x: 0, y: 0 },
    });
    const b = makeHand({
      id: "left",
      landmarks: landmarksFrom({
        5: { x: 0, y: 0 },
        17: { x: 0.2, y: 0 },
      }),
      palmCenter: { x: 0.4, y: 0 },
    });

    // palm width 0.2 each → scale 0.2; raw dist 0.4 → normalized 2.
    expect(measureNormalizedPalmDistance(a, b)).toBeCloseTo(2, 5);
  });
});

describe("extractFeatures", () => {
  it("returns empty aggregates when no hands are present", () => {
    const frame: VisionFrame = { timestampMs: 1, hands: [], inferenceMs: 1 };
    expect(extractFeatures(frame)).toEqual({
      handCount: 0,
      hands: [],
      palmDistance: null,
      meanOpenness: 0,
    });
  });

  it("fills palmDistance only when two hands are present", () => {
    const hand = makeHand({
      landmarks: landmarksFrom({
        5: { x: 0, y: 0 },
        17: { x: 0.2, y: 0 },
        2: { x: 0.1, y: 0.5 },
        3: { x: 0.1, y: 0.4 },
        4: { x: 0.1, y: 0.3 },
        6: { x: 0.05, y: 0.3 },
        8: { x: 0.05, y: 0.1 },
        9: { x: 0.1, y: 0.5 },
        10: { x: 0.1, y: 0.3 },
        12: { x: 0.1, y: 0.1 },
        13: { x: 0.15, y: 0.5 },
        14: { x: 0.15, y: 0.3 },
        16: { x: 0.15, y: 0.1 },
        18: { x: 0.2, y: 0.3 },
        20: { x: 0.2, y: 0.1 },
      }),
      palmCenter: { x: 0.1, y: 0.4 },
    });

    const one: VisionFrame = {
      timestampMs: 1,
      hands: [hand],
      inferenceMs: 1,
    };
    expect(extractFeatures(one).palmDistance).toBeNull();
    expect(extractFeatures(one).handCount).toBe(1);

    const two: VisionFrame = {
      timestampMs: 1,
      hands: [hand, { ...hand, id: "left", palmCenter: { x: 0.5, y: 0.4 } }],
      inferenceMs: 1,
    };
    expect(extractFeatures(two).palmDistance).not.toBeNull();
    expect(extractFeatures(two).handCount).toBe(2);
  });
});

/**
 * Hand with 0.2 camera-unit palm width. Moving `x` shifts every palm anchor
 * equally, which gives predictable normalized velocity in tests.
 */
function makeTemporalHand(x: number, z = 0): HandFrame {
  const landmarks = landmarksFrom({
    0: { x: 0.5 + x, y: 0.7, z },
    2: { x: 0.35 + x, y: 0.55, z },
    3: { x: 0.3 + x, y: 0.45, z },
    4: { x: 0.25 + x, y: 0.35, z },
    5: { x: 0.4 + x, y: 0.6, z },
    6: { x: 0.4 + x, y: 0.45, z },
    8: { x: 0.4 + x, y: 0.25, z },
    9: { x: 0.47 + x, y: 0.58, z },
    10: { x: 0.47 + x, y: 0.43, z },
    12: { x: 0.47 + x, y: 0.22, z },
    13: { x: 0.53 + x, y: 0.58, z },
    14: { x: 0.53 + x, y: 0.43, z },
    16: { x: 0.53 + x, y: 0.24, z },
    17: { x: 0.6 + x, y: 0.6, z },
    18: { x: 0.6 + x, y: 0.46, z },
    20: { x: 0.6 + x, y: 0.29, z },
  });
  return makeHand({
    landmarks,
    palmCenter: { x: 0.5 + x, y: 0.6 },
  });
}

describe("FeatureExtractor temporal features", () => {
  it("reports velocity in palm-widths per second", () => {
    const extractor = new FeatureExtractor();
    extractor.extract({
      timestampMs: 0,
      hands: [makeTemporalHand(0)],
      inferenceMs: 1,
    });
    const result = extractor.extract({
      timestampMs: 100,
      hands: [makeTemporalHand(0.02)],
      inferenceMs: 1,
    });

    // Move 0.02 over 0.1 s with palm width 0.2:
    // 0.02 / 0.2 / 0.1 = 1 palm-width per second.
    expect(result.hands[0].velocity.x).toBeCloseTo(1, 5);
    expect(result.hands[0].speed).toBeCloseTo(1, 5);
  });

  it("makes forwardVelocity positive when z moves toward camera", () => {
    const extractor = new FeatureExtractor();
    extractor.extract({
      timestampMs: 0,
      hands: [makeTemporalHand(0, 0)],
      inferenceMs: 1,
    });
    const result = extractor.extract({
      timestampMs: 100,
      hands: [makeTemporalHand(0, -0.02)],
      inferenceMs: 1,
    });

    expect(result.hands[0].velocity.z).toBeLessThan(0);
    expect(result.hands[0].forwardVelocity).toBeGreaterThan(0);
  });

  it("returns high stability after three stationary samples", () => {
    const extractor = new FeatureExtractor();
    for (const timestampMs of [0, 100, 200]) {
      extractor.extract({
        timestampMs,
        hands: [makeTemporalHand(0)],
        inferenceMs: 1,
      });
    }
    const result = extractor.extract({
      timestampMs: 300,
      hands: [makeTemporalHand(0)],
      inferenceMs: 1,
    });

    expect(result.hands[0].stability).toBeCloseTo(1, 5);
  });

  it("lowers stability while palm moves through history window", () => {
    const extractor = new FeatureExtractor();
    let result = extractor.extract({
      timestampMs: 0,
      hands: [makeTemporalHand(0)],
      inferenceMs: 1,
    });
    for (const [timestampMs, x] of [
      [100, 0.04],
      [200, 0.08],
      [300, 0.12],
    ] as const) {
      result = extractor.extract({
        timestampMs,
        hands: [makeTemporalHand(x)],
        inferenceMs: 1,
      });
    }

    expect(result.hands[0].stability).not.toBeNull();
    expect(result.hands[0].stability!).toBeLessThan(0.55);
  });
});
