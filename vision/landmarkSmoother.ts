import { estimatePalmFacing } from "./palmFacing";
import { emaVec3 } from "./smoothing";
import type { HandFrame, HandId, Vec2, Vec3, VisionFrame } from "./types";

type HandHistory = {
  landmarks: Vec3[];
};

/**
 * EMA smoother per handedness slot. Keeps raw VisionFrame untouched for debug.
 */
export class LandmarkSmoother {
  private readonly alpha: number;
  private history = new Map<HandId, HandHistory>();

  constructor(alpha = 0.55) {
    this.alpha = alpha;
  }

  reset(): void {
    this.history.clear();
  }

  apply(frame: VisionFrame): VisionFrame {
    const hands = frame.hands.map((hand) => this.smoothHand(hand));
    return { ...frame, hands };
  }

  private smoothHand(hand: HandFrame): HandFrame {
    const prev = this.history.get(hand.id);
    if (!prev || prev.landmarks.length !== hand.landmarks.length) {
      this.history.set(hand.id, { landmarks: hand.landmarks.map((p) => ({ ...p })) });
      return hand;
    }

    const landmarks = hand.landmarks.map((point, i) =>
      emaVec3(point, prev.landmarks[i], this.alpha),
    );
    this.history.set(hand.id, { landmarks });

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
