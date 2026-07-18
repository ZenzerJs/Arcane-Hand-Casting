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
