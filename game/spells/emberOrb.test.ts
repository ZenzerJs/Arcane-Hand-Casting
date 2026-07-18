import { describe, expect, it } from "vitest";
import { emberOrbConfig } from "@/game/config/spells";
import type { HandFeatures, PerHandFeatures } from "@/vision/features";
import type { TrackingQuality } from "@/vision/quality";
import {
  EmberOrbMachine,
  aimFromFeatures,
  computeFinalCharge,
  distanceChargeFromPalmDistance,
  emberPreconditionsMet,
  meanForwardVelocity,
} from "./emberOrb";

function hand(
  partial: Partial<PerHandFeatures> & Pick<PerHandFeatures, "id">,
): PerHandFeatures {
  return {
    palmWidth: 0.2,
    openness: 0.9,
    palmFacing: "toward",
    confidence: 0.9,
    velocity: { x: 0, y: 0, z: 0 },
    speed: 0,
    forwardVelocity: 0,
    stability: 0.9,
    ...partial,
  };
}

function features(partial: Partial<HandFeatures> = {}): HandFeatures {
  const hands = partial.hands ?? [
    hand({ id: "left" }),
    hand({ id: "right" }),
  ];
  return {
    handCount: hands.length,
    hands,
    palmDistance: 1.5,
    meanOpenness: 0.9,
    ...partial,
  };
}

describe("emberPreconditionsMet", () => {
  it("passes for GOOD tracking with two open hands", () => {
    expect(emberPreconditionsMet(features(), "GOOD")).toBe(true);
  });

  it("allows GESTURE_UNSTABLE so cast pushes do not cancel", () => {
    expect(emberPreconditionsMet(features(), "GESTURE_UNSTABLE")).toBe(true);
  });

  it("rejects NEED_TWO_HANDS and closed palms", () => {
    expect(emberPreconditionsMet(features(), "NEED_TWO_HANDS")).toBe(false);
    expect(
      emberPreconditionsMet(
        features({
          hands: [
            hand({ id: "left", openness: 0.2 }),
            hand({ id: "right", openness: 0.9 }),
          ],
        }),
        "GOOD",
      ),
    ).toBe(false);
  });
});

describe("charge helpers", () => {
  it("maps palm distance into 0..1 distance charge", () => {
    expect(
      distanceChargeFromPalmDistance(emberOrbConfig.minPalmDistancePalmWidths),
    ).toBeCloseTo(0, 5);
    expect(
      distanceChargeFromPalmDistance(
        emberOrbConfig.minPalmDistancePalmWidths +
          emberOrbConfig.distanceChargeSpanPalmWidths,
      ),
    ).toBeCloseTo(1, 5);
  });

  it("blends hold and distance charge", () => {
    const charge = computeFinalCharge(400, 3.3);
    expect(charge).toBeGreaterThan(0.5);
    expect(charge).toBeLessThanOrEqual(1);
  });
});

describe("aimFromFeatures", () => {
  it("uses fallback when XY motion is tiny", () => {
    expect(aimFromFeatures(features(), 0.5)).toBe(0.5);
  });

  it("aims along average palm velocity", () => {
    const f = features({
      hands: [
        hand({ id: "left", velocity: { x: 1, y: 0, z: 0 }, speed: 1 }),
        hand({ id: "right", velocity: { x: 1, y: 0, z: 0 }, speed: 1 }),
      ],
    });
    expect(aimFromFeatures(f, 0)).toBeCloseTo(0, 5);
  });
});

describe("meanForwardVelocity", () => {
  it("averages both hands", () => {
    const f = features({
      hands: [
        hand({ id: "left", forwardVelocity: 0.2 }),
        hand({ id: "right", forwardVelocity: 0.6 }),
      ],
    });
    expect(meanForwardVelocity(f)).toBeCloseTo(0.4, 5);
  });
});

describe("EmberOrbMachine", () => {
  function tick(
    machine: EmberOrbMachine,
    nowMs: number,
    opts: {
      features?: HandFeatures;
      quality?: TrackingQuality;
      fallbackAimRadians?: number;
    } = {},
  ) {
    return machine.update({
      features: opts.features ?? features(),
      quality: opts.quality ?? "GOOD",
      nowMs,
      fallbackAimRadians: opts.fallbackAimRadians ?? 0,
    });
  }

  it("stays IDLE without two valid hands", () => {
    const machine = new EmberOrbMachine();
    const snap = tick(machine, 0, {
      features: features({
        handCount: 1,
        hands: [hand({ id: "right" })],
        palmDistance: null,
      }),
      quality: "NEED_TWO_HANDS",
    });
    expect(snap.state).toBe("IDLE");
    expect(snap.castEvent).toBeNull();
  });

  it("moves PREPARING → CHARGING after prepare hold", () => {
    const machine = new EmberOrbMachine();
    expect(tick(machine, 0).state).toBe("PREPARING");
    expect(
      tick(machine, emberOrbConfig.prepareHoldMs - 1).state,
    ).toBe("PREPARING");
    expect(
      tick(machine, emberOrbConfig.prepareHoldMs).state,
    ).toBe("CHARGING");
  });

  it("cancels to IDLE when a hand drops mid-charge", () => {
    const machine = new EmberOrbMachine();
    tick(machine, 0);
    tick(machine, emberOrbConfig.prepareHoldMs);
    expect(machine.getState()).toBe("CHARGING");

    const snap = tick(machine, emberOrbConfig.prepareHoldMs + 50, {
      quality: "NEED_TWO_HANDS",
      features: features({
        handCount: 1,
        hands: [hand({ id: "left" })],
        palmDistance: null,
      }),
    });
    expect(snap.state).toBe("IDLE");
    expect(snap.castEvent).toBeNull();
  });

  it("fires one CAST after charge hold + forward impulse window", () => {
    const machine = new EmberOrbMachine();
    tick(machine, 0);
    const chargeStart = emberOrbConfig.prepareHoldMs;
    tick(machine, chargeStart);

    const held = chargeStart + emberOrbConfig.chargeHoldMs;
    const pushing = features({
      hands: [
        hand({ id: "left", forwardVelocity: 0.8 }),
        hand({ id: "right", forwardVelocity: 0.8 }),
      ],
    });

    // Impulse must persist for castImpulseWindowMs.
    tick(machine, held, { features: pushing });
    const castAt = held + emberOrbConfig.castImpulseWindowMs;
    const snap = tick(machine, castAt, { features: pushing });

    expect(snap.castEvent).not.toBeNull();
    expect(snap.castEvent!.radius).toBeGreaterThanOrEqual(
      emberOrbConfig.minRadius,
    );
    expect(snap.state).toBe("CAST");

    const after = tick(machine, castAt + 1, { features: pushing });
    expect(after.state).toBe("COOLDOWN");
    expect(after.castEvent).toBeNull();
  });

  it("blocks a second cast while cooling down", () => {
    const machine = new EmberOrbMachine();
    tick(machine, 0);
    const chargeStart = emberOrbConfig.prepareHoldMs;
    tick(machine, chargeStart);
    const held = chargeStart + emberOrbConfig.chargeHoldMs;
    const pushing = features({
      hands: [
        hand({ id: "left", forwardVelocity: 1 }),
        hand({ id: "right", forwardVelocity: 1 }),
      ],
    });
    tick(machine, held, { features: pushing });
    const castAt = held + emberOrbConfig.castImpulseWindowMs;
    expect(tick(machine, castAt, { features: pushing }).castEvent).not.toBeNull();

    // Same push during cooldown must not emit again.
    for (let t = castAt + 1; t < castAt + emberOrbConfig.cooldownMs; t += 40) {
      const snap = tick(machine, t, { features: pushing });
      expect(snap.castEvent).toBeNull();
    }
  });
});
