import type { Vec2 } from "./types";

/** Exponential moving average for landmark streams — Stage 2/3. */
export function ema(raw: number, previous: number, alpha: number): number {
  return alpha * raw + (1 - alpha) * previous;
}

export function emaVec2(raw: Vec2, previous: Vec2, alpha: number): Vec2 {
  return {
    x: ema(raw.x, previous.x, alpha),
    y: ema(raw.y, previous.y, alpha),
  };
}
