/**
 * Stage 3 — engineered hand features.
 *
 * Purpose:
 *   Convert raw MediaPipe landmarks into numbers that spell state machines
 *   can read (Ember Orb, Aegis). This file does NOT cast spells. It only
 *   measures geometry on the current VisionFrame.
 *
 * Pipeline:
 *   VisionFrame (landmarks)
 *     → per-hand palm width / openness
 *     → two-hand palm distance (normalized)
 *     → HandFeatures object for UI + later game/spells
 */

import { distance } from "./normalize";
import type { HandFrame, HandId, Vec2, Vec3, VisionFrame } from "./types";

/** MediaPipe landmark indices used by the feature helpers below. */
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const MIDDLE_PIP = 10;
const MIDDLE_TIP = 12;
const RING_MCP = 13;
const RING_PIP = 14;
const RING_TIP = 16;
const PINKY_MCP = 17;
const PINKY_PIP = 18;
const PINKY_TIP = 20;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;

/** How much recent motion contributes to the stability estimate. */
const HISTORY_WINDOW_MS = 300;
/** A palm-center RMS movement of 0.15 palm widths counts as unstable. */
const POSITION_STABILITY_TOLERANCE = 0.15;
/** An openness standard deviation of 0.12 counts as unstable. */
const OPENNESS_STABILITY_TOLERANCE = 0.12;
/** Ignore velocity across long gaps, such as a hidden/background tab. */
const MAX_VELOCITY_GAP_MS = 500;

/**
 * Features computed for a single tracked hand.
 * Spell logic later reads these instead of raw landmarks.
 */
export type PerHandFeatures = {
  id: HandId;
  /** Index-MCP ↔ pinky-MCP distance in camera-normalized units. */
  palmWidth: number;
  /**
   * How open the hand is, 0..1.
   * 0 ≈ fist / curled fingers, 1 ≈ fully open palm.
   */
  openness: number;
  /** Palm facing estimate already computed upstream. */
  palmFacing: HandFrame["palmFacing"];
  confidence: number;
  /**
   * Palm velocity in palm-widths per second.
   * x/y follow unmirrored camera coordinates; negative z moves toward camera.
   */
  velocity: Vec3;
  /** Magnitude of velocity across x/y/z, in palm-widths per second. */
  speed: number;
  /** Positive when hand moves toward camera; useful for Ember cast release. */
  forwardVelocity: number;
  /**
   * Recent pose steadiness, 0..1. null until enough samples exist.
   * 1 = held still, 0 = moving/changing pose strongly.
   */
  stability: number | null;
};

/**
 * Aggregate features for the whole frame (0–2 hands).
 * This is the main Stage 3 output type.
 */
export type HandFeatures = {
  handCount: number;
  /** One entry per detected hand, same order as VisionFrame.hands. */
  hands: PerHandFeatures[];
  /**
   * Distance between the two palm centers, divided by average palm width.
   * null when fewer than two hands are present.
   * ~1.0 means palms are about one palm-width apart.
   */
  palmDistance: number | null;
  /** Mean openness across detected hands, or 0 if none. */
  meanOpenness: number;
};

/**
 * Keep a number inside [min, max].
 * Used so openness scores never go outside the 0..1 range we document.
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Measure palm width for one hand.
 *
 * Why: absolute pixel/camera distances change when the player moves closer
 * or farther. Palm width is a personal scale factor, so other distances can
 * be expressed as "how many palm widths".
 *
 * Method: Euclidean distance between index knuckle (MCP 5) and pinky knuckle
 * (MCP 17) — the left/right edges of the palm base.
 */
export function measurePalmWidth(landmarks: Vec3[]): number {
  return distance(
    xy(landmarks[INDEX_MCP]),
    xy(landmarks[PINKY_MCP]),
  );
}

/**
 * Estimate how extended one finger is (0..1).
 *
 * Method — angle at the PIP joint:
 *   - Vector A = PIP → MCP (back toward the knuckle)
 *   - Vector B = PIP → tip (out toward the fingertip)
 *   - Straight finger: A and B point opposite ways → cos ≈ -1 → score ≈ 1
 *   - Curled finger: A and B point similar ways → cos ≈ +1 → score ≈ 0
 *
 * Mapping: score = clamp((-cos + 1) / 2, 0, 1)
 *
 * Why not MCP→tip / bone-length?
 *   A tight fist shrinks every segment, so that ratio stays near 1 and cannot
 *   tell fist from open hand. The PIP angle stays informative either way.
 */
export function fingerExtension(mcp: Vec2, pip: Vec2, tip: Vec2): number {
  const ax = mcp.x - pip.x;
  const ay = mcp.y - pip.y;
  const bx = tip.x - pip.x;
  const by = tip.y - pip.y;
  const magA = Math.hypot(ax, ay);
  const magB = Math.hypot(bx, by);
  if (magA < 1e-6 || magB < 1e-6) return 0;

  const cos = (ax * bx + ay * by) / (magA * magB);
  return clamp((-cos + 1) / 2, 0, 1);
}

/**
 * Average openness across thumb + four fingers for one hand.
 *
 * Why average: Ember Orb wants "reasonably open palms", not a perfect pose.
 * One slightly bent finger should not zero the whole score.
 *
 * Returns 0..1 where higher means more open.
 */
export function measureOpenness(landmarks: Vec3[]): number {
  const fingers: Array<[number, number, number]> = [
    [THUMB_MCP, THUMB_IP, THUMB_TIP],
    [INDEX_MCP, INDEX_PIP, INDEX_TIP],
    [MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP],
    [RING_MCP, RING_PIP, RING_TIP],
    [PINKY_MCP, PINKY_PIP, PINKY_TIP],
  ];

  let total = 0;
  for (const [mcp, pip, tip] of fingers) {
    total += fingerExtension(xy(landmarks[mcp]), xy(landmarks[pip]), xy(landmarks[tip]));
  }
  return total / fingers.length;
}

/**
 * Distance between two palm centers, normalized by average palm width.
 *
 * Why normalize:
 *   Raw distance shrinks when hands move away from the camera.
 *   Dividing by palm width keeps the value roughly size/distance invariant,
 *   which Ember Orb charge needs (docs/HAND_FEATURES.md, ADR-006).
 *
 * Returns null if we do not have exactly the geometry we need (caller
 * usually only calls this when two hands exist).
 */
export function measureNormalizedPalmDistance(
  a: HandFrame,
  b: HandFrame,
): number | null {
  const widthA = measurePalmWidth(a.landmarks);
  const widthB = measurePalmWidth(b.landmarks);
  const scale = (widthA + widthB) / 2;
  if (scale < 1e-6) return null;

  const raw = distance(a.palmCenter, b.palmCenter);
  return raw / scale;
}

/**
 * Build PerHandFeatures for a single HandFrame.
 * Groups the per-hand measurements in one place for extractFeatures.
 */
export function extractPerHandFeatures(hand: HandFrame): PerHandFeatures {
  return {
    id: hand.id,
    palmWidth: measurePalmWidth(hand.landmarks),
    openness: measureOpenness(hand.landmarks),
    palmFacing: hand.palmFacing,
    confidence: hand.confidence,
    // Pure extraction has no previous frame. FeatureExtractor fills these.
    velocity: zeroVec3(),
    speed: 0,
    forwardVelocity: 0,
    stability: null,
  };
}

/**
 * Main Stage 3 entry point.
 *
 * Input:  one VisionFrame from the landmarker + smoother.
 * Output: HandFeatures ready for debug HUD and (later) spell state machines.
 *
 * Steps:
 *   1. Count hands.
 *   2. Compute palm width + openness per hand.
 *   3. If two hands, compute normalized palm-to-palm distance.
 *   4. Average openness for a quick UI summary.
 */
export function extractFeatures(frame: VisionFrame): HandFeatures {
  const hands = frame.hands.map(extractPerHandFeatures);
  const handCount = hands.length;

  const palmDistance =
    frame.hands.length >= 2
      ? measureNormalizedPalmDistance(frame.hands[0], frame.hands[1])
      : null;

  const meanOpenness =
    handCount === 0
      ? 0
      : hands.reduce((sum, hand) => sum + hand.openness, 0) / handCount;

  return {
    handCount,
    hands,
    palmDistance,
    meanOpenness,
  };
}

/**
 * One sample retained for temporal measurements.
 *
 * `center` includes MediaPipe relative z depth. `palmWidth` lets velocity and
 * position variance use palm-width units instead of camera-image units.
 */
type TemporalSample = {
  timestampMs: number;
  center: Vec3;
  palmWidth: number;
  openness: number;
};

/**
 * Stateful Stage 3 feature extractor.
 *
 * Why a class:
 *   A single VisionFrame can describe geometry, but velocity and stability
 *   compare multiple frames. This class owns that short per-hand history.
 *
 * Usage:
 *   const extractor = new FeatureExtractor();
 *   const features = extractor.extract(frame); // call once per vision frame
 */
export class FeatureExtractor {
  private history = new Map<string, TemporalSample[]>();

  /**
   * Clear temporal memory.
   * Call when camera stops/restarts so old positions cannot create a fake
   * velocity spike on the first new frame.
   */
  reset(): void {
    this.history.clear();
  }

  /**
   * Combine current-frame geometry with recent velocity/stability.
   *
   * Steps per hand:
   *   1. Run pure geometric extraction.
   *   2. Match hand to its history using handedness (index fallback if unknown).
   *   3. Compare newest sample to previous sample for velocity.
   *   4. Measure variance over ~300 ms for stability.
   *   5. Remove histories for hands absent from this frame.
   */
  extract(frame: VisionFrame): HandFeatures {
    const base = extractFeatures(frame);
    const activeKeys = new Set<string>();

    const hands = base.hands.map((features, index) => {
      const hand = frame.hands[index];
      const key = historyKey(hand, index, frame.hands);
      activeKeys.add(key);

      const samples = this.history.get(key) ?? [];
      const current: TemporalSample = {
        timestampMs: frame.timestampMs,
        center: palmCenter3D(hand),
        palmWidth: features.palmWidth,
        openness: features.openness,
      };
      const previous = samples.at(-1);
      const velocity = previous
        ? measureVelocity(previous, current)
        : zeroVec3();

      samples.push(current);
      const cutoff = frame.timestampMs - HISTORY_WINDOW_MS;
      const recent = samples.filter((sample) => sample.timestampMs >= cutoff);
      this.history.set(key, recent);

      return {
        ...features,
        velocity,
        speed: Math.hypot(velocity.x, velocity.y, velocity.z),
        // MediaPipe z becomes smaller as a point approaches the camera.
        forwardVelocity: -velocity.z,
        stability: measureStability(recent),
      };
    });

    for (const key of this.history.keys()) {
      if (!activeKeys.has(key)) this.history.delete(key);
    }

    return { ...base, hands };
  }
}

/**
 * Velocity between two samples, normalized to palm-widths per second.
 *
 * Formula for each axis:
 *   velocity = (currentPosition - previousPosition)
 *              / averagePalmWidth
 *              / elapsedSeconds
 */
export function measureVelocity(
  previous: TemporalSample,
  current: TemporalSample,
): Vec3 {
  const elapsedMs = current.timestampMs - previous.timestampMs;
  const scale = (previous.palmWidth + current.palmWidth) / 2;
  if (
    elapsedMs <= 0 ||
    elapsedMs > MAX_VELOCITY_GAP_MS ||
    scale < 1e-6
  ) {
    return zeroVec3();
  }

  const seconds = elapsedMs / 1000;
  return {
    x: (current.center.x - previous.center.x) / scale / seconds,
    y: (current.center.y - previous.center.y) / scale / seconds,
    z: (current.center.z - previous.center.z) / scale / seconds,
  };
}

/**
 * Convert recent movement and pose variation into a 0..1 stability score.
 *
 * Position term:
 *   RMS distance of palm centers from their mean, normalized by palm width.
 *
 * Pose term:
 *   Standard deviation of openness scores.
 *
 * Worst term wins. This prevents a stationary palm with rapidly curling
 * fingers from being called stable, and also catches a rigid but moving hand.
 */
export function measureStability(samples: TemporalSample[]): number | null {
  if (samples.length < 3) return null;

  const meanCenter = samples.reduce(
    (sum, sample) => ({
      x: sum.x + sample.center.x / samples.length,
      y: sum.y + sample.center.y / samples.length,
      z: sum.z + sample.center.z / samples.length,
    }),
    zeroVec3(),
  );
  const meanWidth =
    samples.reduce((sum, sample) => sum + sample.palmWidth, 0) /
    samples.length;
  const safeWidth = Math.max(meanWidth, 1e-6);

  const positionRms = Math.sqrt(
    samples.reduce((sum, sample) => {
      const dx = sample.center.x - meanCenter.x;
      const dy = sample.center.y - meanCenter.y;
      const dz = sample.center.z - meanCenter.z;
      return sum + (dx * dx + dy * dy + dz * dz) / samples.length;
    }, 0),
  ) / safeWidth;

  const meanOpenness =
    samples.reduce((sum, sample) => sum + sample.openness, 0) /
    samples.length;
  const opennessStd = Math.sqrt(
    samples.reduce((sum, sample) => {
      const delta = sample.openness - meanOpenness;
      return sum + (delta * delta) / samples.length;
    }, 0),
  );

  const positionInstability =
    positionRms / POSITION_STABILITY_TOLERANCE;
  const opennessInstability =
    opennessStd / OPENNESS_STABILITY_TOLERANCE;
  return 1 - clamp(
    Math.max(positionInstability, opennessInstability),
    0,
    1,
  );
}

/**
 * Use handedness as stable identity. If MediaPipe reports unknown or duplicate
 * labels, append array index so two hands never share one history buffer.
 */
function historyKey(
  hand: HandFrame,
  index: number,
  allHands: HandFrame[],
): string {
  const duplicateIds =
    allHands.filter((candidate) => candidate.id === hand.id).length > 1;
  return hand.id === "unknown" || duplicateIds
    ? `${hand.id}:${index}`
    : hand.id;
}

/** Approximate 3D palm center from same five anchors used by 2D palmCenter. */
function palmCenter3D(hand: HandFrame): Vec3 {
  const indices = [0, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP];
  return indices.reduce(
    (sum, index) => ({
      x: sum.x + hand.landmarks[index].x / indices.length,
      y: sum.y + hand.landmarks[index].y / indices.length,
      z: sum.z + hand.landmarks[index].z / indices.length,
    }),
    zeroVec3(),
  );
}

function zeroVec3(): Vec3 {
  return { x: 0, y: 0, z: 0 };
}

/** Drop depth — 2D feature math only needs x/y. */
function xy(point: Vec3): Vec2 {
  return { x: point.x, y: point.y };
}
