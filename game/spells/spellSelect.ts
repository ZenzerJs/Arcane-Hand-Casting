/**
 * Spell selector — pure gesture routing for the live camera view.
 *
 *   - ONE open palm facing the camera → Aegis shield
 *   - Hands VERTICALLY stacked + open + far enough → Fireball
 *   - Hands HORIZONTALLY stacked + any finger-beam overlap → Lightning
 *   - Diagonal / missing hands / no overlap → none
 *
 * Finger beams are invisible interaction volumes (see pointerBeams.ts).
 * No Pixi/React here so Vitest can drive synthetic hands.
 */

import { aegisConfig, emberOrbConfig } from "@/game/config/spells";
import type { HandFeatures } from "@/vision/features";
import type { HandStack } from "@/game/spells/pointerBeams";

export type ActiveSpell = "fireball" | "lightning" | "aegis" | null;

export type SpellSelectInput = {
  features: HandFeatures;
  stack: HandStack;
  /** True when any cross-hand finger beams overlap. */
  beamsOverlap: boolean;
};

/**
 * Pick the active spell from stack orientation + beam interaction.
 */
export function selectSpell(input: SpellSelectInput): ActiveSpell {
  const { features, stack, beamsOverlap } = input;

  // One steady open palm toward the camera raises Aegis.
  if (features.handCount === 1) {
    const hand = features.hands[0];
    if (
      hand.openness >= aegisConfig.minOpenness &&
      hand.palmFacing === "toward"
    ) {
      return "aegis";
    }
    return null;
  }

  if (features.handCount < 2) return null;
  if (features.palmDistance === null) return null;

  if (stack === "vertical") {
    const everyHandOpen = features.hands.every(
      (hand) => hand.openness >= emberOrbConfig.minOpenness,
    );
    if (
      everyHandOpen &&
      features.palmDistance >= emberOrbConfig.minPalmDistancePalmWidths
    ) {
      return "fireball";
    }
    return null;
  }

  if (stack === "horizontal" && beamsOverlap) {
    return "lightning";
  }

  return null;
}
