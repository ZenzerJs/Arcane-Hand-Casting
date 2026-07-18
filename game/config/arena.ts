/** Stage 4 keyboard arena tunables — no hand tracking yet. */

export const arenaConfig = {
  width: 960,
  height: 540,
  /** Top-down feel: orbs fly without falling. */
  gravityY: 0,
  castCooldownMs: 450,
  orbSpeed: 520,
  orbRadius: 14,
  orbLifetimeMs: 3500,
  targetRadius: 26,
  targetCount: 6,
  wallThickness: 40,
  /** Radians per second while holding left/right. */
  aimTurnSpeed: 2.6,
  playerX: 140,
  playerY: 270,
} as const;
