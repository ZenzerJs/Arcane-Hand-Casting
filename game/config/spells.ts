/** Tunable spell thresholds — keep magic numbers out of state machines. */

export const emberOrbConfig = {
  minPalmDistancePalmWidths: 0.8,
  /** Both hands must be at least this open to prepare/charge. */
  minOpenness: 0.65,
  prepareHoldMs: 150,
  chargeHoldMs: 200,
  cooldownMs: 800,
  castVelocityThreshold: 0.35,
  minRadius: 12,
  maxRadius: 48,
  minPower: 0.55,
  maxPower: 1.35,
  holdChargeWeight: 0.55,
  distanceChargeWeight: 0.45,
  /**
   * Palm-distance span mapped to distanceCharge 0..1.
   * At minPalmDistance → 0; at min + this span → 1.
   */
  distanceChargeSpanPalmWidths: 2.5,
  /** Below this XY speed, cast aim falls back to arena-right (0 rad). */
  minAimSpeed: 0.15,
  /** How long mean forward velocity must stay hot to fire. */
  castImpulseWindowMs: 120,
} as const;

/** Lightning is triggered by cross-hand fingertip beams (pointerBeams.ts). */
export const lightningConfig = {
  /**
   * Tip→tip grow time when a finger first connects (ms).
   * After that the arc stays continuously lit — no dark restrike gap.
   */
  travelMs: 120,
  /** Hold one jagged path this long before reshaping it (ms). */
  pathRefreshMs: 90,
  /** Brightness shimmer floor (0..1). 1 = rock steady, lower = stormier. */
  shimmerFloor: 0.66,
} as const;

export const aegisConfig = {
  activateHoldMs: 200,
  energyDrainPerSecond: 0.15,
  shieldRadius: 80,
  /** Single palm must be at least this open to raise the shield. */
  minOpenness: 0.7,
} as const;
