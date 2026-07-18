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
 * Lightning visuals: five tip↔tip arcs (matching digits). Unreadable tips
 * drop the tip↔tip attempt and emit a short local flicker instead.
 *
 * Coordinates are camera-normalized (0..1, x un-mirrored).
 */

import { fingerExtension } from "@/vision/features";
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
/** Tip within this margin of frame edge = hard to trust. */
const TIP_EDGE_MARGIN = 0.02;
/** PIP→TIP shorter than this (normalized) = collapsed / unreadable. */
const MIN_TIP_BONE = 0.012;
/** Below this extension, tip pose is too curled to bridge hands. */
const MIN_TIP_EXTENSION = 0.18;
/** Local flicker length when tip↔tip arc is abandoned (normalized). */
const FLICKER_JET = 0.04;
/**
 * When tips collapse onto each other, use a short spark along the beam —
 * absolute length, NOT a fraction of BEAM_LENGTH (that drew screen-wide rods).
 */
const COLLAPSE_JET = 0.07;
/** Tips closer than this are treated as collapsed. */
const COLLAPSE_GAP = 0.012;

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

/** Visual bolt: tip↔tip arc, or short local flicker when tips unreadable. */
export type BoltSegment = {
  from: Vec2;
  to: Vec2;
  /** Matching digit (0=thumb … 4=pinky). */
  finger: number;
  kind: "arc" | "flicker";
};

/**
 * Exactly five bolts — one per digit (thumb→pinky).
 *
 * Readable tips → arc from hand A tip to matching hand B tip (L↔R).
 * Either tip hard to read → drop the bridge; short flicker on best tip.
 * Tips nearly stacked → short outward jet (still `arc`, not an orb).
 */
export function fingerBolts(
  handA: HandFrame,
  handB: HandFrame,
): BoltSegment[] {
  const beamsA = computeHandBeams(handA);
  const beamsB = computeHandBeams(handB);
  return beamsA.map((a, i) => {
    const b = beamsB[i];
    const readableA = tipReadable(handA, i);
    const readableB = tipReadable(handB, i);

    if (!readableA || !readableB) {
      const anchor = readableA ? a : readableB ? b : a;
      return {
        from: anchor.origin,
        to: jetAlongDir(anchor, FLICKER_JET),
        finger: i,
        kind: "flicker",
      };
    }

    const gap = dist(a.origin, b.origin);
    // Prefer real tip↔tip. Only collapse → short spark when tips coincide.
    if (gap < COLLAPSE_GAP) {
      return {
        from: a.origin,
        to: jetAlongDir(a, COLLAPSE_JET),
        finger: i,
        kind: "arc",
      };
    }

    return { from: a.origin, to: b.origin, finger: i, kind: "arc" };
  });
}

/** True when fingertip landmarks look trustworthy for a tip↔tip bolt. */
export function tipReadable(hand: HandFrame, finger: number): boolean {
  const [mcp, pip, tip] = FINGER_CHAINS[finger];
  const tipPt = xy(hand.landmarks[tip]);
  if (
    tipPt.x <= TIP_EDGE_MARGIN ||
    tipPt.x >= 1 - TIP_EDGE_MARGIN ||
    tipPt.y <= TIP_EDGE_MARGIN ||
    tipPt.y >= 1 - TIP_EDGE_MARGIN
  ) {
    return false;
  }
  const pipPt = xy(hand.landmarks[pip]);
  if (dist(tipPt, pipPt) < MIN_TIP_BONE) return false;
  const mcpPt = xy(hand.landmarks[mcp]);
  return fingerExtension(mcpPt, pipPt, tipPt) >= MIN_TIP_EXTENSION;
}

/** Short jet from fingertip along beam direction (absolute normalized length). */
function jetAlongDir(beam: Beam, length: number): Vec2 {
  const dx = beam.tip.x - beam.origin.x;
  const dy = beam.tip.y - beam.origin.y;
  const mag = Math.hypot(dx, dy) || 1;
  return {
    x: beam.origin.x + (dx / mag) * length,
    y: beam.origin.y + (dy / mag) * length,
  };
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
