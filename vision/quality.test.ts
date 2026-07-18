import { describe, expect, it } from "vitest";
import { extractFeatures, type HandFeatures } from "./features";
import { assessTrackingQuality } from "./quality";
import type { HandFrame, VisionFrame } from "./types";

/** Build a valid centered hand, then override one condition per test. */
function makeHand(options: {
  id?: HandFrame["id"];
  confidence?: number;
  palmWidth?: number;
  edgeX?: number;
} = {}): HandFrame {
  const palmWidth = options.palmWidth ?? 0.2;
  const landmarks = Array.from({ length: 21 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
  }));
  landmarks[5] = { x: 0.5 - palmWidth / 2, y: 0.55, z: 0 };
  landmarks[17] = { x: 0.5 + palmWidth / 2, y: 0.55, z: 0 };
  if (options.edgeX !== undefined) {
    // Two clipped fingertips cross the rejection threshold.
    landmarks[8].x = options.edgeX;
    landmarks[12].x = options.edgeX;
  }

  return {
    id: options.id ?? "right",
    timestampMs: 0,
    landmarks,
    wrist: { x: 0.5, y: 0.65 },
    palmCenter: { x: 0.5, y: 0.55 },
    indexTip: { x: landmarks[8].x, y: landmarks[8].y },
    confidence: options.confidence ?? 0.9,
    palmFacing: "toward",
    palmTowardScore: 0.8,
  };
}

function makeFrame(hands: HandFrame[]): VisionFrame {
  return { timestampMs: 0, hands, inferenceMs: 1 };
}

function withStability(
  features: HandFeatures,
  stability: number,
): HandFeatures {
  return {
    ...features,
    hands: features.hands.map((hand) => ({ ...hand, stability })),
  };
}

describe("assessTrackingQuality", () => {
  it("reports NO_HANDS for an empty frame", () => {
    const frame = makeFrame([]);
    expect(assessTrackingQuality(frame, extractFeatures(frame))).toBe(
      "NO_HANDS",
    );
  });

  it("reports NEED_TWO_HANDS for Ember when only one hand exists", () => {
    const frame = makeFrame([makeHand()]);
    expect(assessTrackingQuality(frame, extractFeatures(frame))).toBe(
      "NEED_TWO_HANDS",
    );
  });

  it("accepts one valid hand when interaction requires one", () => {
    const frame = makeFrame([makeHand()]);
    expect(
      assessTrackingQuality(frame, extractFeatures(frame), {
        requiredHands: 1,
      }),
    ).toBe("GOOD");
  });

  it("reports LOW_CONFIDENCE after hand-count gate passes", () => {
    const frame = makeFrame([
      makeHand({ id: "right", confidence: 0.4 }),
      makeHand({ id: "left" }),
    ]);
    expect(assessTrackingQuality(frame, extractFeatures(frame))).toBe(
      "LOW_CONFIDENCE",
    );
  });

  it("reports HANDS_TOO_CLOSE_TO_CAMERA for oversized palm width", () => {
    const frame = makeFrame([
      makeHand({ id: "right", palmWidth: 0.4 }),
      makeHand({ id: "left" }),
    ]);
    expect(assessTrackingQuality(frame, extractFeatures(frame))).toBe(
      "HANDS_TOO_CLOSE_TO_CAMERA",
    );
  });

  it("reports HANDS_OUT_OF_FRAME when a landmark reaches edge", () => {
    const frame = makeFrame([
      makeHand({ id: "right", edgeX: 0.01 }),
      makeHand({ id: "left" }),
    ]);
    expect(assessTrackingQuality(frame, extractFeatures(frame))).toBe(
      "HANDS_OUT_OF_FRAME",
    );
  });

  it("allows one fingertip near edge when palm remains visible", () => {
    const right = makeHand({ id: "right" });
    right.landmarks[8].x = 0.005;
    const frame = makeFrame([right, makeHand({ id: "left" })]);
    expect(assessTrackingQuality(frame, extractFeatures(frame))).toBe("GOOD");
  });

  it("reports GESTURE_UNSTABLE after geometry gates pass", () => {
    const frame = makeFrame([
      makeHand({ id: "right" }),
      makeHand({ id: "left" }),
    ]);
    const features = withStability(extractFeatures(frame), 0.2);
    expect(assessTrackingQuality(frame, features)).toBe(
      "GESTURE_UNSTABLE",
    );
  });

  it("reports GOOD for two valid stable hands", () => {
    const frame = makeFrame([
      makeHand({ id: "right" }),
      makeHand({ id: "left" }),
    ]);
    const features = withStability(extractFeatures(frame), 0.9);
    expect(assessTrackingQuality(frame, features)).toBe("GOOD");
  });
});
