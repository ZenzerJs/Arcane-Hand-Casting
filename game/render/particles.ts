/**
 * Tiny additive spark particles shared by the spell renderers (ember, aegis,
 * laser) so every effect sheds drifting sparks with the same feel.
 *
 * Pure helpers — no state here. Each renderer owns its own `Spark[]` pool.
 */

import { Graphics } from "pixi.js";

export type Spark = {
  x: number;
  y: number;
  /** Velocity in px/s. */
  vx: number;
  vy: number;
  /** 1 → 0; the spark is dead at <= 0. */
  life: number;
  size: number;
};

/** Advance positions and fade life; drops dead sparks in place. */
export function stepSparks(
  list: Spark[],
  dt: number,
  lifeMs: number,
  drag = 0.98,
): void {
  const decay = dt / (lifeMs / 1000);
  for (const p of list) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= drag;
    p.vy *= drag;
    p.life -= decay;
  }
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].life <= 0) list.splice(i, 1);
  }
}

/** Draw additive dots; alpha fades with remaining life. */
export function drawSparks(
  g: Graphics,
  list: readonly Spark[],
  color: number,
  alphaScale: number,
): void {
  for (const p of list) {
    g.circle(p.x, p.y, p.size);
    g.fill({ color, alpha: p.life * alphaScale });
  }
}
