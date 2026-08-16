import { describe, expect, it } from "vitest";
import type { HandFeatures, PerHandFeatures } from "@/vision/features";
import {
  selectSpell,
  selectionKey,
  SpellHysteresis,
  type SpellSelection,
} from "./spellSelect";

function hand(
  openness: number,
  palmFacing: PerHandFeatures["palmFacing"] = "toward",
): PerHandFeatures {
  return {
    id: "unknown",
    palmWidth: 0.2,
    fingerExtensions: [openness, openness, openness, openness, openness],
    openness,
    palmFacing,
    confidence: 0.9,
    velocity: { x: 0, y: 0, z: 0 },
    speed: 0,
    forwardVelocity: 0,
    stability: 1,
  };
}

function features(
  opennessPerHand: number[],
  palmDistance: number | null,
  palmFacing: PerHandFeatures["palmFacing"] = "toward",
): HandFeatures {
  const hands = opennessPerHand.map((o) => hand(o, palmFacing));
  return {
    handCount: hands.length,
    hands,
    palmDistance,
    meanOpenness:
      hands.reduce((s, h) => s + h.openness, 0) / (hands.length || 1),
  };
}

describe("selectSpell", () => {
  it("ember with one closed fist", () => {
    const result = selectSpell({ features: features([0.3], null), stack: null });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["ember"]);
    expect(result.active).toBe("ember");
  });

  it("aegis with one open palm toward camera", () => {
    const result = selectSpell({ features: features([0.9], null), stack: null });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["aegis"]);
    expect(result.active).toBe("aegis");
  });

  it("no aegis when palm faces away", () => {
    const result = selectSpell({
      features: features([0.9], null, "away"),
      stack: null,
    });
    expect(result.perHand).toEqual([null]);
    expect(result.active).toBeNull();
  });

  it("returns nothing with zero hands", () => {
    const result = selectSpell({ features: features([], null), stack: null });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual([]);
    expect(result.active).toBeNull();
  });

  it("fireball when vertically stacked + palms facing one another + spread", () => {
    const result = selectSpell({
      features: features([0.8, 0.75], 1.5, "side"),
      stack: "vertical",
    });
    expect(result.twoHand).toBe("fireball");
    expect(result.perHand).toEqual([null, null]);
    expect(result.active).toBe("fireball");
  });

  it("no fireball when vertical but palms face the camera (aegis)", () => {
    const result = selectSpell({
      features: features([0.9, 0.9], 1.5),
      stack: "vertical",
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["aegis", "aegis"]);
  });

  it("no fireball when vertical but hands closed", () => {
    const result = selectSpell({
      features: features([0.2, 0.1], 1.5),
      stack: "vertical",
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["ember", "ember"]);
    expect(result.active).toBe("ember");
  });

  it("lightning when horizontal + palms facing one another + spread", () => {
    const result = selectSpell({
      features: features([0.8, 0.75], 1.5, "side"),
      stack: "horizontal",
    });
    expect(result.twoHand).toBe("lightning");
    expect(result.perHand).toEqual([null, null]);
    expect(result.active).toBe("lightning");
  });

  it("does not fire lightning when spread palms face the camera (aegis)", () => {
    const result = selectSpell({
      features: features([0.9, 0.9], 1.5),
      stack: "horizontal",
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["aegis", "aegis"]);
  });

  it("no lightning when horizontal but hands closed", () => {
    const result = selectSpell({
      features: features([0.3, 0.3], 1.5),
      stack: "horizontal",
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["ember", "ember"]);
  });

  it("double aegis when two open palms are not stacked", () => {
    const result = selectSpell({
      features: features([0.9, 0.9], 1.5),
      stack: null,
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["aegis", "aegis"]);
    expect(result.active).toBe("aegis");
  });

  it("double ember with two fists", () => {
    const result = selectSpell({
      features: features([0.2, 0.3], null),
      stack: null,
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["ember", "ember"]);
    expect(result.active).toBe("ember");
  });

  it("ember + aegis when one fist and one open palm", () => {
    const result = selectSpell({
      features: features([0.3, 0.9], 1.5),
      stack: null,
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["ember", "aegis"]);
    expect(result.active).toBe("ember");
  });

  it("mixed hands ignore stacking so each hand casts its own sign", () => {
    const result = selectSpell({
      features: features([0.9, 0.3], 1.5),
      stack: "horizontal",
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["aegis", "ember"]);
  });

  it("gun hand (index out, thumb up) casts an arcane laser", () => {
    const gunHand: PerHandFeatures = {
      id: "unknown",
      palmWidth: 0.2,
      fingerExtensions: [0.7, 0.9, 0.1, 0.1, 0.1],
      openness: 0.38,
      palmFacing: "side",
      confidence: 0.9,
      velocity: { x: 0, y: 0, z: 0 },
      speed: 0,
      forwardVelocity: 0,
      stability: 1,
    };
    const result = selectSpell({
      features: {
        handCount: 1,
        hands: [gunHand],
        palmDistance: null,
        meanOpenness: 0.38,
      },
      stack: null,
    });
    expect(result.twoHand).toBeNull();
    expect(result.perHand).toEqual(["gun"]);
    expect(result.active).toBe("gun");
  });
});

describe("SpellHysteresis", () => {
  function selection(
    twoHand: SpellSelection["twoHand"],
    perHand: SpellSelection["perHand"],
  ): SpellSelection {
    return {
      twoHand,
      perHand,
      active:
        twoHand ??
        (perHand.find((spell) => spell !== null) ?? null),
    };
  }

  it("holds lightning through single-frame aegis jitter", () => {
    const h = new SpellHysteresis();
    const lightning = selection("lightning", [null, null]);
    const aegis = selection(null, ["aegis", "aegis"]);

    expect(h.update(lightning)).toEqual(lightning); // first frame adopts
    expect(h.update(lightning)).toEqual(lightning);
    expect(h.update(aegis)).toEqual(lightning); // jitter held
    expect(h.update(aegis)).toEqual(lightning); // jitter held
    expect(h.update(aegis)).toEqual(aegis); // third stable frame commits
  });

  it("keeps a spell lit briefly when hands go attuning", () => {
    const h = new SpellHysteresis();
    const ember = selection(null, ["ember"]);
    const attuning = selection(null, [null]);

    h.update(ember);
    expect(h.update(attuning)).toEqual(ember);
    expect(h.update(attuning)).toEqual(ember);
    expect(h.update(attuning)).toEqual(ember);
    expect(h.update(attuning)).toEqual(ember);
    expect(h.update(attuning)).toEqual(attuning); // release frame reached
  });

  it("commits immediately when the hand count changes", () => {
    const h = new SpellHysteresis();
    const one = selection(null, ["ember"]);
    const two = selection(null, ["ember", "ember"]);

    h.update(one);
    expect(h.update(two)).toEqual(two); // no engage wait on hand appearance
  });

  it("reset clears committed memory", () => {
    const h = new SpellHysteresis();
    const ember = selection(null, ["ember"]);
    h.update(ember);
    h.reset();
    // After reset the first frame adopts again with no hold.
    expect(h.update(ember)).toEqual(ember);
  });

  it("selectionKey distinguishes two-hand from per-hand routing", () => {
    expect(selectionKey(selection("lightning", [null, null]))).toBe(
      "2h:lightning",
    );
    expect(selectionKey(selection(null, ["aegis", "ember"]))).toBe(
      "per:aegis,ember",
    );
  });
});
