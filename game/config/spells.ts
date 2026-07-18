/** Tunable spell thresholds — keep magic numbers out of state machines. */

export const emberOrbConfig = {
  minPalmDistancePalmWidths: 0.8,
  prepareHoldMs: 150,
  chargeHoldMs: 200,
  cooldownMs: 800,
  castVelocityThreshold: 0.35,
  minRadius: 12,
  maxRadius: 48,
  holdChargeWeight: 0.55,
  distanceChargeWeight: 0.45,
} as const;

export const aegisConfig = {
  activateHoldMs: 200,
  energyDrainPerSecond: 0.15,
  shieldRadius: 80,
} as const;
