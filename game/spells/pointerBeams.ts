/**
 * Fingertip geometry — pure, testable.
 *
 * Hand stack orientation (from palm centers) gates which spell can fire:
 *   vertical stack   → fireball
 *   horizontal stack → lightning (hands side by side, fingers spread)
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
/**
 * How strongly one axis must dominate the other for a clear stack.
 * dy/dx ≥ this → vertical; dx/dy ≥ this → horizontal.
 */
const STACK_AXIS_RATIO = 1.15;
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

/** All five fingertip beams for one hand (used for lightning arcs). */
export function computeHandBeams(
  hand: HandFrame,
  length = BEAM_LENGTH,
): Beam[] {
  return FINGER_CHAINS.map((_, i) => computeFingerBeam(hand, i, length));
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
