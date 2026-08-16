/** Tunable spell thresholds — keep magic numbers out of state machines. */

export const emberOrbConfig = {
  minPalmDistancePalmWidths: 0.8,
  /** Both hands must be at least this open to fire the singularity. */
  minOpenness: 0.65,
} as const;

/**
 * Lightning (Storm Weave) — hands side by side with fingers spread.
 * Triggered by horizontal stack + open hands; arcs draw tip↔tip regardless.
 */
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
  /** Both hands must be at least this open to fire arcs. */
  minOpenness: 0.6,
} as const;

export const aegisConfig = {
  activateHoldMs: 200,
  energyDrainPerSecond: 0.15,
  shieldRadius: 80,
  /** Single palm must be at least this open to raise the shield. */
  minOpenness: 0.7,
} as const;

/**
 * Ember Grasp — one closed fist gathers molten embers that burn nearby wisps.
 */
export const emberGraspConfig = {
  /** Above this openness the hand reads as open, not a fist. */
  maxOpenness: 0.4,
  /** Ember burn radius (normalized) around the fist. */
  burnRadius: 0.09,
} as const;
