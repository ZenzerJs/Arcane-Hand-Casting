/**
 * Spell selector — pure gesture routing for the live camera view.
 *
 *   - ONE closed fist → Ember Grasp
 *   - ONE open palm facing the camera → Aegis shield
 *   - ONE gun hand (index out, thumb up) → Arcane Laser
 *   - Hands VERTICALLY stacked, palms facing one another, spread → Fireball
 *   - Hands HORIZONTALLY stacked, palms facing one another, spread → Lightning
 *   - Otherwise each hand casts independently → double-cast
 *
 * Double-cast: when no two-hand spell matches, every hand routes on its own
 * sign — a fist becomes Ember and an open palm becomes Aegis. That lets the
 * player cast Ember + Aegis simultaneously (one per hand) or two of a kind by
 * holding the same sign on both hands.
 *
 * One-hand signs (fist vs open palm) are classified by nearest-neighbour
 * similarity against example datasets (see signMatching.ts), not by exact
 * openness/facing thresholds.
 *
 * No Pixi/React here so Vitest can drive synthetic hands.
 */

import { emberOrbConfig } from "@/game/config/spells";
import { classifyHandSign, handSignVector } from "@/game/spells/signMatching";
import type { HandFeatures, PerHandFeatures } from "@/vision/features";
import type { HandStack } from "@/game/spells/pointerBeams";

export type ActiveSpell =
  | "fireball"
  | "lightning"
  | "aegis"
  | "ember"
  | "gun"
  | null;

/** A spell a single hand can hold on its own. */
export type HandSpell = "aegis" | "ember" | "gun";

/** Two-hand spell, or null when the hands are not cooperating. */
export type TwoHandSpell = "fireball" | "lightning" | null;

export type SpellSelectInput = {
  features: HandFeatures;
  stack: HandStack;
};

export type SpellSelection = {
  /** Fireball/lightning when both hands make a two-hand pose, else null. */
  twoHand: TwoHandSpell;
  /**
   * Independent one-hand spell per detected hand, same order as
   * `features.hands`. All null while a two-hand spell is active.
   */
  perHand: (HandSpell | null)[];
  /** Representative spell for HUD/status styling (two-hand wins). */
  active: ActiveSpell;
};

/**
 * Pick the active spell(s) from hand count + stack orientation + openness.
 */
export function selectSpell(input: SpellSelectInput): SpellSelection {
  const { features, stack } = input;
  const hands = features.hands;

  // Two-hand spells need both palms cooperating on a stacked pose; try them
  // first so they keep priority over independent per-hand casting.
  if (features.handCount >= 2 && features.palmDistance !== null) {
    const twoHand = selectTwoHand(features, stack);
    if (twoHand) {
      return { twoHand, perHand: [null, null], active: twoHand };
    }
  }

  // No two-hand spell — route each hand on its own sign (double-cast path).
  const perHand = hands.map(oneHandSpell);
  return { twoHand: null, perHand, active: summarize(perHand) };
}

/**
 * Spell a single hand holds by its own sign, via dataset similarity: a hand
 * close to the fist examples becomes Ember, one close to the open-palm-toward
 * examples becomes Aegis, a gun hand becomes the Arcane Laser. Hands the
 * datasets do not recognize (including the two-hand-only "lightning" spread
 * palm) cast nothing on their own.
 */
export function oneHandSpell(hand: PerHandFeatures): HandSpell | null {
  const sign = classifyHandSign(handSignVector(hand));
  return sign === "lightning" ? null : sign;
}

/**
 * Fireball or lightning when both hands make the stacked two-hand pose.
 *
 * Both spells share one per-hand sign — spread fingers with the palm edge-on
 * (facing the other hand) — matched by similarity. The stack orientation is
 * what separates them: vertical → singularity, horizontal → storm weave.
 */
function selectTwoHand(
  features: HandFeatures,
  stack: HandStack,
): "fireball" | "lightning" | null {
  const bothSpreadSidePalm = features.hands.every(
    (hand) => classifyHandSign(handSignVector(hand)) === "lightning",
  );

  if (stack === "vertical") {
    if (
      bothSpreadSidePalm &&
      features.palmDistance !== null &&
      features.palmDistance >= emberOrbConfig.minPalmDistancePalmWidths
    ) {
      return "fireball";
    }
    return null;
  }

  if (stack === "horizontal") {
    if (bothSpreadSidePalm) {
      return "lightning";
    }
    return null;
  }

  return null;
}

/** First active hand spell, or null — the HUD's single representative. */
function summarize(perHand: (HandSpell | null)[]): ActiveSpell {
  return perHand.find((spell): spell is HandSpell => spell !== null) ?? null;
}

/* --------------------------- Stabilisation ---------------------------- */

/**
 * Stable identity for a selection so hysteresis can tell "the same spell is
 * still being held" from "the player switched poses".
 */
export function selectionKey(selection: SpellSelection): string {
  if (selection.twoHand) return `2h:${selection.twoHand}`;
  return `per:${selection.perHand.map((spell) => spell ?? "-").join(",")}`;
}

function isAttuning(selection: SpellSelection): boolean {
  return (
    selection.twoHand === null &&
    selection.perHand.every((spell) => spell === null)
  );
}

/**
 * Debounces raw spell selections so a spell does not flicker on/off from
 * single-frame hand jitter (the classic lightning↔ward stutter).
 *
 * - A new spell must hold for `engageFrames` before it becomes active.
 * - An active spell is kept for `releaseFrames` of "attuning" before dropping.
 * - A hand appearing/disappearing commits immediately — that is a discrete
 *   event, not jitter, so a held spell never lingers on the wrong hand.
 *
 * Frame-based (not time-based) on purpose: at low inference FPS each frame is
 * already a coarse sample, so the hold stays short in wall-clock terms.
 */
export class SpellHysteresis {
  private committed: SpellSelection | null = null;
  private pending: SpellSelection | null = null;
  private pendingFrames = 0;
  private attuningFrames = 0;

  constructor(
    private readonly engageFrames = 3,
    private readonly releaseFrames = 5,
  ) {}

  /** Feed a raw selection each vision frame; returns the stable selection. */
  update(raw: SpellSelection): SpellSelection {
    // First frame adopts immediately so there is no warm-up delay.
    if (!this.committed) {
      this.committed = raw;
      return raw;
    }

    // Hand count changed — adopt immediately rather than holding a stale
    // per-hand spell against a different hand.
    if (raw.perHand.length !== this.committed.perHand.length) {
      this.committed = raw;
      this.settle();
      return raw;
    }

    if (selectionKey(raw) === selectionKey(this.committed)) {
      this.settle();
      return this.committed;
    }

    // Raw is "attuning" (no spell) — keep the active spell briefly so it
    // glides out instead of popping on a single dropped frame.
    if (isAttuning(raw)) {
      this.pending = null;
      this.pendingFrames = 0;
      this.attuningFrames += 1;
      if (this.attuningFrames >= this.releaseFrames) {
        this.committed = raw;
        this.attuningFrames = 0;
        return raw;
      }
      return this.committed;
    }

    // A different, non-attuning selection — hold briefly before switching so
    // lightning↔ward transitions do not stutter mid-gesture.
    this.attuningFrames = 0;
    if (this.pending && selectionKey(this.pending) === selectionKey(raw)) {
      this.pendingFrames += 1;
    } else {
      this.pending = raw;
      this.pendingFrames = 1;
    }
    if (this.pendingFrames >= this.engageFrames) {
      this.committed = raw;
      this.settle();
      return raw;
    }
    return this.committed;
  }

  /** Drop all memory — call when the camera stops/restarts. */
  reset(): void {
    this.committed = null;
    this.settle();
  }

  /** Clear pending/timers without dropping the committed selection. */
  private settle(): void {
    this.pending = null;
    this.pendingFrames = 0;
    this.attuningFrames = 0;
  }
}
