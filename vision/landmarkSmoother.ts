import { emaVec2 } from "./smoothing";
import type { HandFrame, HandId, Vec2, VisionFrame } from "./types";

type HandHistory = {
  landmarks: Vec2[];
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
      emaVec2(point, prev.landmarks[i], this.alpha),
    );
    this.history.set(hand.id, { landmarks });

    const wrist = landmarks[0];
    const palmCenter = mean([
      landmarks[0],
      landmarks[5],
      landmarks[9],
      landmarks[13],
      landmarks[17],
    ]);

    return {
      ...hand,
      landmarks,
      wrist,
      palmCenter,
      indexTip: landmarks[8],
    };
  }
}

function mean(points: Vec2[]): Vec2 {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), {
    x: 0,
    y: 0,
  });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
