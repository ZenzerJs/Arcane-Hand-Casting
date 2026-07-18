export type Vec2 = { x: number; y: number };

/** MediaPipe landmark with relative depth (smaller z = closer to camera). */
export type Vec3 = { x: number; y: number; z: number };

export type HandId = "left" | "right" | "unknown";

/** Geometric palm-facing estimate relative to the camera. */
export type PalmFacing = "toward" | "away" | "side";

export type HandFrame = {
  id: HandId;
  timestampMs: number;
  /** Indices follow MediaPipe hand landmark convention (21 points). */
  landmarks: Vec3[];
  wrist: Vec2;
  palmCenter: Vec2;
  indexTip: Vec2;
  confidence: number;
  /** Palm facing the camera, back of hand, or edge-on. */
  palmFacing: PalmFacing;
  /** Positive ≈ toward camera; magnitude is confidence of the estimate. */
  palmTowardScore: number;
};

export type VisionFrame = {
  timestampMs: number;
  hands: HandFrame[];
  inferenceMs: number;
};
