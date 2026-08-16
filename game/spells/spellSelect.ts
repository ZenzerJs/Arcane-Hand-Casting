/**
 * Spell selector — pure gesture routing for the live camera view.
 *
 *   - ONE closed fist → Ember Grasp
 *   - ONE open palm facing the camera → Aegis shield
 *   - Hands VERTICALLY stacked + open + far enough → Fireball
 *   - Hands HORIZONTALLY stacked + open → Lightning
 *   - Diagonal / missing hands / wrong openness → none
 *
 * No Pixi/React here so Vitest can drive synthetic hands.
 */

import {
  aegisConfig,
  emberGraspConfig,
  emberOrbConfig,
  lightningConfig,
} from "@/game/config/spells";
import type { HandFeatures } from "@/vision/features";
import type { HandStack } from "@/game/spells/pointerBeams";

export type ActiveSpell =
  | "fireball"
  | "lightning"
  | "aegis"
  | "ember"
  | null;

export type SpellSelectInput = {
  features: HandFeatures;
  stack: HandStack;
};

/**
 * Pick the active spell from hand count + stack orientation + openness.
 */
export function selectSpell(input: SpellSelectInput): ActiveSpell {
  const { features, stack } = input;

  if (features.handCount === 1) {
    const hand = features.hands[0];
    // A closed fist coalesces molten embers.
    if (hand.openness <= emberGraspConfig.maxOpenness) {
      return "ember";
    }
    // One steady open palm toward the camera raises Aegis.
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

  const everyHandOpen = features.hands.every(
    (hand) => hand.openness >= emberOrbConfig.minOpenness,
  );

  if (stack === "vertical") {
    if (
      everyHandOpen &&
      features.palmDistance >= emberOrbConfig.minPalmDistancePalmWidths
    ) {
      return "fireball";
    }
    return null;
  }

  if (stack === "horizontal") {
    // Hands side by side with fingers spread — arcs leap fingertip to
    // fingertip. Openness is the only gate; beam overlap was too fragile.
    if (
      features.hands.every(
        (hand) => hand.openness >= lightningConfig.minOpenness,
      )
    ) {
      return "lightning";
    }
    return null;
  }

  return null;
}
