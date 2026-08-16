import { estimatePalmFacing } from "./palmFacing";
import { emaVec3 } from "./smoothing";
import type { HandFrame, Vec2, Vec3, VisionFrame } from "./types";

type HandHistory = {
  landmarks: Vec3[];
};

/**
 * EMA smoother per handedness slot. Keeps raw VisionFrame untouched for debug.
 */
export class LandmarkSmoother {
  private readonly alpha: number;
  private history = new Map<string, HandHistory>();

  constructor(alpha = 0.55) {
    this.alpha = alpha;
  }

  reset(): void {
    this.history.clear();
  }

  apply(frame: VisionFrame): VisionFrame {
    const activeKeys = new Set<string>();
    const hands = frame.hands.map((hand, index) => {
      const key = historyKey(hand, index, frame.hands);
      activeKeys.add(key);
      return this.smoothHand(hand, key);
    });
    for (const key of this.history.keys()) {
      if (!activeKeys.has(key)) this.history.delete(key);
    }
    return { ...frame, hands };
  }

  private smoothHand(hand: HandFrame, key: string): HandFrame {
    const prev = this.history.get(key);
    if (!prev || prev.landmarks.length !== hand.landmarks.length) {
      this.history.set(key, { landmarks: hand.landmarks.map((p) => ({ ...p })) });
      return hand;
    }

    const landmarks = hand.landmarks.map((point, i) =>
      emaVec3(point, prev.landmarks[i], this.alpha),
    );
    this.history.set(key, { landmarks });

    const wrist = landmarks[0];
    const palm = mean([
      landmarks[0],
      landmarks[5],
      landmarks[9],
      landmarks[13],
      landmarks[17],
    ]);
    const { facing, towardScore } = estimatePalmFacing(landmarks, hand.id);

    return {
      ...hand,
      landmarks,
      wrist: { x: wrist.x, y: wrist.y },
      palmCenter: palm,
      indexTip: { x: landmarks[8].x, y: landmarks[8].y },
      palmFacing: facing,
      palmTowardScore: towardScore,
    };
  }
}

function mean(points: Vec3[]): Vec2 {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}

/**
 * Use handedness as a stable identity. When MediaPipe reports unknown or
 * duplicate labels, append the array index so two hands never share one
 * smoothing buffer (which would cross-contaminate their landmarks).
 */
function historyKey(
  hand: HandFrame,
  index: number,
  allHands: HandFrame[],
): string {
  const duplicateIds =
    allHands.filter((candidate) => candidate.id === hand.id).length > 1;
  return hand.id === "unknown" || duplicateIds
    ? `${hand.id}:${index}`
    : hand.id;
}
