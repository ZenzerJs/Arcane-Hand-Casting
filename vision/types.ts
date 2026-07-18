export type Vec2 = { x: number; y: number };

export type HandId = "left" | "right" | "unknown";

export type HandFrame = {
  id: HandId;
  timestampMs: number;
  /** Indices follow MediaPipe hand landmark convention (21 points). */
  landmarks: Vec2[];
  wrist: Vec2;
  palmCenter: Vec2;
  indexTip: Vec2;
  confidence: number;
};

export type VisionFrame = {
  timestampMs: number;
  hands: HandFrame[];
  inferenceMs: number;
};
