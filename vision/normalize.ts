import type { Vec2 } from "./types";

/** Translate landmarks around an origin and scale by palm width — Stage 3. */
export function normalizeLandmarks(
  landmarks: Vec2[],
  origin: Vec2,
  palmWidth: number,
): Vec2[] {
  const scale = Math.max(palmWidth, 1e-6);
  return landmarks.map((point) => ({
    x: (point.x - origin.x) / scale,
    y: (point.y - origin.y) / scale,
  }));
}

export function distance(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}
