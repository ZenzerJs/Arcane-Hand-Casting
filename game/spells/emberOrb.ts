/**
 * Ember Orb state machine — Stage 5.
 *
 * Pure logic: HandFeatures + TrackingQuality in → cast events out.
 * No Pixi/Matter/React so Vitest can drive synthetic hands.
 */

import { emberOrbConfig } from "@/game/config/spells";
import { clamp } from "@/vision/features";
import type { HandFeatures } from "@/vision/features";
import type { TrackingQuality } from "@/vision/quality";

export type EmberState =
  | "IDLE"
  | "PREPARING"
  | "CHARGING"
  | "CAST"
  | "COOLDOWN";

export type EmberCastEvent = {
  aimRadians: number;
  charge: number;
  radius: number;
  power: number;
};

export type EmberSnapshot = {
  state: EmberState;
  charge: number;
  holdMs: number;
  aimRadians: number;
  castEvent: EmberCastEvent | null;
  cooldownRemainingMs: number;
};

export type EmberTickInput = {
  features: HandFeatures;
  quality: TrackingQuality;
  nowMs: number;
  /** Fallback aim when palm XY motion is too small (keyboard aim). */
  fallbackAimRadians: number;
};

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t, 0, 1);
}

/** Hard tracking failures cancel Ember. GESTURE_UNSTABLE is allowed so a cast push does not abort charge. */
const EMBER_HARD_FAIL: ReadonlySet<TrackingQuality> = new Set([
  "NO_HANDS",
  "NEED_TWO_HANDS",
  "LOW_CONFIDENCE",
  "HANDS_TOO_CLOSE_TO_CAMERA",
  "HANDS_OUT_OF_FRAME",
]);

/**
 * Preconditions for preparing/charging Ember.
 * Two open hands, enough palm distance, and no hard tracking failure.
 */
export function emberPreconditionsMet(
  features: HandFeatures,
  quality: TrackingQuality,
): boolean {
  if (EMBER_HARD_FAIL.has(quality)) return false;
  if (features.handCount < 2) return false;
  if (features.palmDistance === null) return false;
  if (features.palmDistance < emberOrbConfig.minPalmDistancePalmWidths) {
    return false;
  }
  return features.hands.every(
    (hand) => hand.openness >= emberOrbConfig.minOpenness,
  );
}

/**
 * Distance charge 0..1 from normalized palm separation.
 */
export function distanceChargeFromPalmDistance(
  palmDistance: number | null,
): number {
  if (palmDistance === null) return 0;
  const start = emberOrbConfig.minPalmDistancePalmWidths;
  const span = emberOrbConfig.distanceChargeSpanPalmWidths;
  return clamp((palmDistance - start) / span, 0, 1);
}

/**
 * Hold charge 0..1 while in CHARGING (ramps over ~1s of hold beyond chargeHoldMs).
 */
export function holdChargeFromMs(holdMs: number): number {
  const ramp = Math.max(emberOrbConfig.chargeHoldMs, 400);
  return clamp(holdMs / ramp, 0, 1);
}

export function computeFinalCharge(
  holdMs: number,
  palmDistance: number | null,
): number {
  const hold = holdChargeFromMs(holdMs);
  const dist = distanceChargeFromPalmDistance(palmDistance);
  return clamp(
    emberOrbConfig.holdChargeWeight * hold +
      emberOrbConfig.distanceChargeWeight * dist,
    0,
    1,
  );
}

/**
 * Aim from average palm XY velocity. Camera coords: +x right, +y down.
 * Arena uses same convention. Weak motion → fallbackAimRadians.
 */
export function aimFromFeatures(
  features: HandFeatures,
  fallbackAimRadians: number,
): number {
  if (features.hands.length === 0) return fallbackAimRadians;

  const vx =
    features.hands.reduce((sum, hand) => sum + hand.velocity.x, 0) /
    features.hands.length;
  const vy =
    features.hands.reduce((sum, hand) => sum + hand.velocity.y, 0) /
    features.hands.length;
  const speed = Math.hypot(vx, vy);
  if (speed < emberOrbConfig.minAimSpeed) return fallbackAimRadians;
  return Math.atan2(vy, vx);
}

export function meanForwardVelocity(features: HandFeatures): number {
  if (features.hands.length === 0) return 0;
  return (
    features.hands.reduce((sum, hand) => sum + hand.forwardVelocity, 0) /
    features.hands.length
  );
}

export class EmberOrbMachine {
  private state: EmberState = "IDLE";
  private stateEnteredAt = 0;
  private chargeHoldStartedAt = 0;
  private impulseStartedAt: number | null = null;
  private lastCastAt = -Infinity;
  private charge = 0;
  private aimRadians = 0;

  reset(nowMs = 0): void {
    this.state = "IDLE";
    this.stateEnteredAt = nowMs;
    this.chargeHoldStartedAt = nowMs;
    this.impulseStartedAt = null;
    this.charge = 0;
  }

  getState(): EmberState {
    return this.state;
  }

  /**
   * Advance machine one vision/engine sample.
   * At most one castEvent per tick.
   */
  update(input: EmberTickInput): EmberSnapshot {
    const { features, quality, nowMs, fallbackAimRadians } = input;
    this.aimRadians = aimFromFeatures(features, fallbackAimRadians);
    const ready = emberPreconditionsMet(features, quality);
    const forward = meanForwardVelocity(features);
    let castEvent: EmberCastEvent | null = null;

    switch (this.state) {
      case "IDLE": {
        if (ready) {
          this.enter("PREPARING", nowMs);
        }
        this.charge = 0;
        break;
      }
      case "PREPARING": {
        if (!ready) {
          this.enter("IDLE", nowMs);
          this.charge = 0;
          break;
        }
        if (nowMs - this.stateEnteredAt >= emberOrbConfig.prepareHoldMs) {
          this.enter("CHARGING", nowMs);
          this.chargeHoldStartedAt = nowMs;
        }
        this.charge = computeFinalCharge(
          Math.max(0, nowMs - this.stateEnteredAt),
          features.palmDistance,
        );
        break;
      }
      case "CHARGING": {
        if (!ready) {
          this.enter("IDLE", nowMs);
          this.impulseStartedAt = null;
          this.charge = 0;
          break;
        }

        const holdMs = nowMs - this.chargeHoldStartedAt;
        this.charge = computeFinalCharge(holdMs, features.palmDistance);

        const cooldownClear =
          nowMs - this.lastCastAt >= emberOrbConfig.cooldownMs;
        const heldLongEnough = holdMs >= emberOrbConfig.chargeHoldMs;
        const impulseHot = forward >= emberOrbConfig.castVelocityThreshold;

        if (impulseHot) {
          if (this.impulseStartedAt === null) this.impulseStartedAt = nowMs;
        } else {
          this.impulseStartedAt = null;
        }

        const impulseHeld =
          this.impulseStartedAt !== null &&
          nowMs - this.impulseStartedAt >= emberOrbConfig.castImpulseWindowMs;

        if (heldLongEnough && impulseHeld && cooldownClear) {
          castEvent = {
            aimRadians: this.aimRadians,
            charge: this.charge,
            radius: lerp(
              emberOrbConfig.minRadius,
              emberOrbConfig.maxRadius,
              this.charge,
            ),
            power: lerp(
              emberOrbConfig.minPower,
              emberOrbConfig.maxPower,
              this.charge,
            ),
          };
          this.lastCastAt = nowMs;
          this.impulseStartedAt = null;
          this.enter("CAST", nowMs);
        }
        break;
      }
      case "CAST": {
        // One-frame emit state, then cooldown.
        this.enter("COOLDOWN", nowMs);
        this.charge = 0;
        break;
      }
      case "COOLDOWN": {
        this.charge = 0;
        if (nowMs - this.stateEnteredAt >= emberOrbConfig.cooldownMs) {
          this.enter(ready ? "PREPARING" : "IDLE", nowMs);
        }
        break;
      }
    }

    return {
      state: this.state,
      charge: this.charge,
      holdMs:
        this.state === "CHARGING" || this.state === "PREPARING"
          ? nowMs - this.stateEnteredAt
          : 0,
      aimRadians: this.aimRadians,
      castEvent,
      cooldownRemainingMs: Math.max(
        0,
        emberOrbConfig.cooldownMs - (nowMs - this.lastCastAt),
      ),
    };
  }

  private enter(next: EmberState, nowMs: number): void {
    this.state = next;
    this.stateEnteredAt = nowMs;
  }
}
