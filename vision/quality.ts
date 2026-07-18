import type { HandFeatures } from "./features";
import type { HandFrame, VisionFrame } from "./types";

export type TrackingQuality =
  | "GOOD"
  | "NO_HANDS"
  | "NEED_TWO_HANDS"
  | "HANDS_TOO_CLOSE_TO_CAMERA"
  | "HANDS_OUT_OF_FRAME"
  | "LOW_CONFIDENCE"
  | "GESTURE_UNSTABLE";

export const QUALITY_MESSAGES: Record<TrackingQuality, string> = {
  GOOD: "Tracking ready",
  NO_HANDS: "Show your hands to the camera",
  NEED_TWO_HANDS: "Show both hands",
  HANDS_TOO_CLOSE_TO_CAMERA: "Move farther back",
  HANDS_OUT_OF_FRAME: "Keep hands in frame",
  LOW_CONFIDENCE: "Lighting or tracking is weak",
  GESTURE_UNSTABLE: "Hold steady",
};

export function qualityMessage(state: TrackingQuality): string {
  return QUALITY_MESSAGES[state];
}

/**
 * Tunable Stage 3 quality thresholds.
 *
 * These are starting values, not universal truths. Camera field-of-view,
 * lighting, and player hand size differ. `/sandbox` exists to tune them on
 * real hardware before spell state machines depend on these states.
 */
export const QUALITY_THRESHOLDS = {
  /** Handedness score is the best per-hand confidence exposed here. */
  minConfidence: 0.55,
  /** Palm wider than 32% of camera frame means player is probably too close. */
  maxPalmWidth: 0.32,
  /** Palm center needs breathing room; wrists naturally sit near bottom edge. */
  palmCenterEdgeMargin: 0.04,
  /** Allow tiny fingertip-edge noise without declaring hand clipped. */
  fingertipEdgeMargin: 0.01,
  /** One clipped fingertip is usable; two means pose geometry is unreliable. */
  maxClippedFingertips: 1,
  /** Below this recent stability score, ask player to hold steady. */
  minStability: 0.55,
} as const;

export type QualityOptions = {
  /**
   * Number of hands required by current interaction.
   * Ember Orb uses 2; Aegis will use 1.
   */
  requiredHands?: 1 | 2;
};

/**
 * Turn frame + engineered features into one user-facing tracking state.
 *
 * Priority is deliberate:
 *   1. Missing hands gives clearest instruction.
 *   2. Weak/clipped/too-close tracking means geometry cannot be trusted.
 *   3. Instability matters only after tracking itself is valid.
 *   4. Otherwise tracking is GOOD.
 *
 * Note: `confidence` currently comes from MediaPipe handedness category score,
 * because this API result does not expose a separate per-hand tracking score.
 * Treat LOW_CONFIDENCE as a practical proxy and tune on real cameras.
 */
export function assessTrackingQuality(
  frame: VisionFrame,
  features: HandFeatures,
  options: QualityOptions = {},
): TrackingQuality {
  const requiredHands = options.requiredHands ?? 2;

  if (features.handCount === 0) return "NO_HANDS";
  if (features.handCount < requiredHands) return "NEED_TWO_HANDS";

  if (
    features.hands.some(
      (hand) => hand.confidence < QUALITY_THRESHOLDS.minConfidence,
    )
  ) {
    return "LOW_CONFIDENCE";
  }

  if (
    features.hands.some(
      (hand) => hand.palmWidth > QUALITY_THRESHOLDS.maxPalmWidth,
    )
  ) {
    return "HANDS_TOO_CLOSE_TO_CAMERA";
  }

  if (frame.hands.some(isNearFrameEdge)) {
    return "HANDS_OUT_OF_FRAME";
  }

  if (
    features.hands.some(
      (hand) =>
        hand.stability !== null &&
        hand.stability < QUALITY_THRESHOLDS.minStability,
    )
  ) {
    return "GESTURE_UNSTABLE";
  }

  return "GOOD";
}

/**
 * Decide whether useful hand geometry is clipped by frame.
 *
 * Do not inspect all 21 points: wrists naturally enter from bottom edge, and
 * our live calibration showed that rule falsely rejected two visible palms.
 * Instead:
 *   - Require palm center to stay comfortably inside frame.
 *   - Allow one fingertip near edge (minor noise / partial crop).
 *   - Reject two or more clipped fingertips.
 */
function isNearFrameEdge(hand: HandFrame): boolean {
  const palmMargin = QUALITY_THRESHOLDS.palmCenterEdgeMargin;
  const palm = hand.palmCenter;
  if (
    palm.x <= palmMargin ||
    palm.x >= 1 - palmMargin ||
    palm.y <= palmMargin ||
    palm.y >= 1 - palmMargin
  ) {
    return true;
  }

  const fingertipIndices = [4, 8, 12, 16, 20];
  const tipMargin = QUALITY_THRESHOLDS.fingertipEdgeMargin;
  const clippedFingertips = fingertipIndices.filter((index) => {
    const point = hand.landmarks[index];
    return (
      point.x <= tipMargin ||
      point.x >= 1 - tipMargin ||
      point.y <= tipMargin ||
      point.y >= 1 - tipMargin
    );
  }).length;

  return (
    clippedFingertips > QUALITY_THRESHOLDS.maxClippedFingertips
  );
}
