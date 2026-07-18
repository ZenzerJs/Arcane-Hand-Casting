/**
 * Pure cast-gate helpers for Stage 4 keyboard Ember.
 * Kept free of Pixi/Matter so Vitest can cover them without a DOM.
 */

/**
 * True when enough time has passed since the last successful cast.
 *
 * @param nowMs - Current clock (performance.now or fake time in tests)
 * @param lastCastMs - Timestamp of previous cast, or -Infinity if never cast
 * @param cooldownMs - Minimum wait between casts
 */
export function canCast(
  nowMs: number,
  lastCastMs: number,
  cooldownMs: number,
): boolean {
  return nowMs - lastCastMs >= cooldownMs;
}

/**
 * Remaining cooldown in milliseconds (0 when ready).
 */
export function cooldownRemainingMs(
  nowMs: number,
  lastCastMs: number,
  cooldownMs: number,
): number {
  return Math.max(0, cooldownMs - (nowMs - lastCastMs));
}
