/**
 * Finger-beam geometry — pure, testable.
 *
 * Every fingertip (thumb + 4 fingers) projects an invisible beam along its
 * PIP→TIP direction. Beams are never drawn; they only exist for interaction
 * tests (cross-hand segment overlap / tip proximity).
 *
 * Hand stack orientation (from palm centers) gates which spell can fire:
 *   vertical stack   → fireball
 *   horizontal stack → lightning (when any cross-hand beams overlap)
 *
 * Coordinates are camera-normalized (0..1, x un-mirrored).
 */

import type { HandFrame, Vec2 } from "@/vision/types";

/** [mcp, pip/ip, tip] landmark indices for each digit. */
const FINGER_CHAINS: ReadonlyArray<readonly [number, number, number]> = [
  [2, 3, 4], // thumb
  [5, 6, 8], // index
  [9, 10, 12], // middle
  [13, 14, 16], // ring
  [17, 18, 20], // pinky
];

/** Beam length in normalized units — long enough to cross the frame. */
export const BEAM_LENGTH = 2.4;
/** Fingertips closer than this (normalized) count as overlapping. */
const TIP_TOUCH_DISTANCE = 0.1;
/**
 * How strongly one axis must dominate the other for a clear stack.
 * dy/dx ≥ this → vertical; dx/dy ≥ this → horizontal.
 */
const STACK_AXIS_RATIO = 1.25;

export type Beam = {
  /** Beam start = fingertip. */
  origin: Vec2;
  /** Beam end = origin projected along finger direction. */
  tip: Vec2;
  /** Which digit (0=thumb … 4=pinky). */
  finger: number;
};

export type HandStack = "vertical" | "horizontal" | null;

export type BeamHit = {
  a: Beam;
  b: Beam;
};

function xy(p: { x: number; y: number }): Vec2 {
  return { x: p.x, y: p.y };
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Project an invisible beam for one finger.
 * Direction = PIP/IP → TIP, normalized then scaled by `length`.
 */
export function computeFingerBeam(
  hand: HandFrame,
  finger: number,
  length = BEAM_LENGTH,
): Beam {
  const [mcp, pip, tip] = FINGER_CHAINS[finger];
  const origin = xy(hand.landmarks[tip]);
  const joint = xy(hand.landmarks[pip]);
  // Fall back toward MCP if PIP≈TIP (tight curl).
  let dx = origin.x - joint.x;
  let dy = origin.y - joint.y;
  if (Math.hypot(dx, dy) < 1e-4) {
    const knuckle = xy(hand.landmarks[mcp]);
    dx = origin.x - knuckle.x;
    dy = origin.y - knuckle.y;
  }
  const mag = Math.hypot(dx, dy) || 1e-6;
  dx /= mag;
  dy /= mag;
  return {
    origin,
    tip: { x: origin.x + dx * length, y: origin.y + dy * length },
    finger,
  };
}

/** All five invisible fingertip beams for one hand. */
export function computeHandBeams(
  hand: HandFrame,
  length = BEAM_LENGTH,
): Beam[] {
  return FINGER_CHAINS.map((_, i) => computeFingerBeam(hand, i, length));
}

/** Standard orientation sign for segment-intersection test. */
function cross(o: Vec2, a: Vec2, b: Vec2): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

/** True if segments p1p2 and p3p4 properly intersect. */
export function segmentsIntersect(
  p1: Vec2,
  p2: Vec2,
  p3: Vec2,
  p4: Vec2,
): boolean {
  const d1 = cross(p3, p4, p1);
  const d2 = cross(p3, p4, p2);
  const d3 = cross(p1, p2, p3);
  const d4 = cross(p1, p2, p4);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

/**
 * Beams overlap when they cross, or when the fingertips nearly touch.
 */
export function beamsOverlap(a: Beam, b: Beam): boolean {
  if (dist(a.origin, b.origin) <= TIP_TOUCH_DISTANCE) return true;
  return segmentsIntersect(a.origin, a.tip, b.origin, b.tip);
}

/**
 * Find EVERY cross-hand beam pair that overlaps.
 * Multiple fingertip collisions → multiple lightning bolts.
 */
export function findBeamHits(
  handA: HandFrame,
  handB: HandFrame,
): BeamHit[] {
  const beamsA = computeHandBeams(handA);
  const beamsB = computeHandBeams(handB);
  const hits: BeamHit[] = [];
  for (const a of beamsA) {
    for (const b of beamsB) {
      if (beamsOverlap(a, b)) hits.push({ a, b });
    }
  }
  return hits;
}

/** First hit only — thin wrapper for callers that want a single pair. */
export function findBeamHit(
  handA: HandFrame,
  handB: HandFrame,
): BeamHit | null {
  return findBeamHits(handA, handB)[0] ?? null;
}

/** Visual bolt segment in normalized camera space (from → to). */
export type BoltSegment = readonly [Vec2, Vec2];

/**
 * Exactly five bolts — one per digit (thumb→pinky).
 *
 * Each bolt leaves that finger on hand A and travels toward the matching
 * fingertip on hand B. One bolt per finger pair, never a hit-mesh swarm.
 */
export function fingerBolts(
  handA: HandFrame,
  handB: HandFrame,
): BoltSegment[] {
  const beamsA = computeHandBeams(handA);
  const beamsB = computeHandBeams(handB);
  return beamsA.map((a, i) => {
    const b = beamsB[i];
    const gap = dist(a.origin, b.origin);
    // Tips nearly stacked → fall back to a short outward jet so the bolt
    // still has length instead of collapsing into an orb.
    if (gap < 0.04) return jetAlongBeam(a);
    return [a.origin, b.origin] as const;
  });
}

/** Outward jet from fingertip partway along the invisible beam. */
function jetAlongBeam(beam: Beam, fraction = 0.55): BoltSegment {
  return [
    beam.origin,
    {
      x: beam.origin.x + (beam.tip.x - beam.origin.x) * fraction,
      y: beam.origin.y + (beam.tip.y - beam.origin.y) * fraction,
    },
  ];
}

/**
 * Classify two palm centers as stacked vertically, horizontally, or neither.
 *
 * Camera coords: +x right, +y down. Absolute deltas only — order of hands
 * does not matter.
 */
export function handStackOrientation(a: Vec2, b: Vec2): HandStack {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  if (dx < 1e-6 && dy < 1e-6) return null;
  if (dy >= dx * STACK_AXIS_RATIO) return "vertical";
  if (dx >= dy * STACK_AXIS_RATIO) return "horizontal";
  return null;
}
