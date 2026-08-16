import { beforeEach, describe, expect, it } from "vitest";
import type { PerHandFeatures } from "@/vision/features";
import {
  classifyHandSign,
  clearRecordedSamples,
  facingScalar,
  getRecordedSamples,
  handSignVector,
  learnFromLiveVector,
  recordSignSample,
  recordedSampleCounts,
  signSimilarity,
  signScores,
  SIGN_DATASETS,
} from "./signMatching";

/** Flat per-finger vector so tests read as a single openness value. */
function flat(openness: number, facing = 1) {
  return {
    fingers: [openness, openness, openness, openness, openness],
    facing,
  };
}

describe("facingScalar", () => {
  it("maps the palm-facing categories to scalar values", () => {
    expect(facingScalar("toward")).toBe(1);
    expect(facingScalar("away")).toBe(0);
    expect(facingScalar("side")).toBe(0.5);
  });
});

describe("handSignVector", () => {
  it("distills per-finger extension and facing into a matchable vector", () => {
    const hand: PerHandFeatures = {
      id: "unknown",
      palmWidth: 0.2,
      fingerExtensions: [0.1, 0.2, 0.3, 0.4, 0.5],
      openness: 0.3,
      palmFacing: "toward",
      confidence: 0.9,
      velocity: { x: 0, y: 0, z: 0 },
      speed: 0,
      forwardVelocity: 0,
      stability: 1,
    };
    expect(handSignVector(hand)).toEqual({
      fingers: [0.1, 0.2, 0.3, 0.4, 0.5],
      facing: 1,
    });
  });
});

describe("signSimilarity", () => {
  it("is 1 for an exact example match", () => {
    const example = SIGN_DATASETS.ember[0];
    expect(signSimilarity(example, SIGN_DATASETS.ember)).toBeCloseTo(1, 5);
  });

  it("drops toward 0 for a far-away vector", () => {
    expect(signSimilarity(flat(1, 0), SIGN_DATASETS.ember)).toBeLessThan(0.05);
  });
});

describe("signScores", () => {
  it("returns a similarity per sign", () => {
    const scores = signScores(flat(0.9));
    expect(scores.aegis).toBeGreaterThan(0.9);
    expect(scores.ember).toBeLessThan(0.2);
  });
});

describe("classifyHandSign", () => {
  it("classifies a fist as ember without needing an exact value", () => {
    // Slightly looser than the loosest seed fist, still close enough to match.
    expect(classifyHandSign(flat(0.38))).toBe("ember");
  });

  it("classifies an open palm toward the camera as aegis", () => {
    expect(classifyHandSign(flat(0.85))).toBe("aegis");
  });

  it("rejects an open palm facing away", () => {
    expect(classifyHandSign(flat(0.9, 0))).toBeNull();
  });

  it("classifies an edge-on spread palm as the lightning sign", () => {
    expect(classifyHandSign(flat(0.9, 0.5))).toBe("lightning");
  });

  it("rejects an ambiguous half-open hand", () => {
    expect(classifyHandSign(flat(0.5))).toBeNull();
  });

  it("classifies a gun hand (index out, thumb up)", () => {
    expect(
      classifyHandSign({
        fingers: [0.7, 0.9, 0.1, 0.1, 0.1],
        facing: 0.5,
      }),
    ).toBe("gun");
  });

  it("does not confuse a flat open palm with a gun hand", () => {
    expect(classifyHandSign(flat(0.85))).toBe("aegis");
  });
});

describe("recording", () => {
  beforeEach(() => {
    clearRecordedSamples();
  });

  it("teaches a new pose into a sign's dataset", () => {
    const pose = flat(0.55); // seeds reject this ambiguous pose
    expect(classifyHandSign(pose)).toBeNull();

    recordSignSample("aegis", pose, { x: 0.4, y: 0.6 });
    expect(recordedSampleCounts()).toEqual({
      ember: 0,
      aegis: 1,
      gun: 0,
      lightning: 0,
    });
    expect(classifyHandSign(pose)).toBe("aegis");
  });

  it("stores only the values and position of each sample", () => {
    recordSignSample("ember", flat(0.3), { x: 0.25, y: 0.75 });
    const samples = getRecordedSamples("ember");
    expect(samples).toHaveLength(1);
    expect(samples[0].palm).toEqual({ x: 0.25, y: 0.75 });
    expect(samples[0].vector.fingers).toHaveLength(5);
  });

  it("clears recorded samples back to the seed datasets", () => {
    recordSignSample("ember", flat(0.5), { x: 0, y: 0 });
    recordSignSample("ember", flat(0.45), { x: 0, y: 0 });
    expect(recordedSampleCounts().ember).toBe(2);

    clearRecordedSamples();
    expect(recordedSampleCounts()).toEqual({
      ember: 0,
      aegis: 0,
      gun: 0,
      lightning: 0,
    });
  });
});

describe("learnFromLiveVector", () => {
  beforeEach(() => {
    clearRecordedSamples();
  });

  it("adds a confident, novel vector to the sign's dataset", () => {
    const pose = { fingers: [0.4, 0.2, 0.2, 0.2, 0.2], facing: 1 };
    expect(
      learnFromLiveVector("ember", pose, { x: 0.5, y: 0.5 }, 1000),
    ).toBe(true);
    expect(recordedSampleCounts().ember).toBe(1);
  });

  it("skips vectors that are already well represented", () => {
    const seed = SIGN_DATASETS.ember[0];
    expect(learnFromLiveVector("ember", seed, { x: 0, y: 0 }, 1000)).toBe(false);
    expect(recordedSampleCounts().ember).toBe(0);
  });

  it("throttles rapid frames", () => {
    const poseA = { fingers: [0.4, 0.2, 0.2, 0.2, 0.2], facing: 1 };
    const poseB = { fingers: [0.34, 0.3, 0.3, 0.3, 0.32], facing: 1 };
    expect(learnFromLiveVector("ember", poseA, { x: 0, y: 0 }, 1000)).toBe(true);
    expect(learnFromLiveVector("ember", poseB, { x: 0, y: 0 }, 1100)).toBe(false);
    expect(learnFromLiveVector("ember", poseB, { x: 0, y: 0 }, 1500)).toBe(true);
  });
});
