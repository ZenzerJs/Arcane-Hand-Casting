import { describe, expect, it } from "vitest";
import {
  createTrial,
  pointSegmentDistance,
  startTrial,
  stepTrial,
  trialConfig,
  type TrialInput,
} from "./trial";

/** Deterministic rng that cycles through fixed values. */
function fixedRng(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

const idleInput: TrialInput = {
  voidCenter: null,
  voidRadius: 0,
  arcs: [],
  aegis: null,
};

describe("startTrial", () => {
  it("spawns wave 1 with base wisp count and full lives", () => {
    const state = startTrial(createTrial(), 1000, fixedRng([0.5]));
    expect(state.status).toBe("running");
    expect(state.wave).toBe(1);
    expect(state.lives).toBe(trialConfig.lives);
    expect(state.wisps).toHaveLength(trialConfig.baseWisps);
  });

  it("delays first hazard by the grace period", () => {
    const state = startTrial(createTrial(), 1000, fixedRng([0.5]));
    expect(state.nextHazardAtMs).toBe(1000 + trialConfig.hazardGraceMs);
  });
});

describe("stepTrial", () => {
  it("does nothing while idle", () => {
    const state = createTrial();
    const events = stepTrial(state, idleInput, 16, 0);
    expect(events).toEqual([]);
    expect(state.status).toBe("idle");
  });

  it("kills a wisp touched by a lightning arc", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    const wisp = state.wisps[0];
    const input: TrialInput = {
      ...idleInput,
      arcs: [
        {
          from: { x: wisp.pos.x - 0.2, y: wisp.pos.y },
          to: { x: wisp.pos.x + 0.2, y: wisp.pos.y },
        },
      ],
    };
    const before = state.wisps.length;
    const events = stepTrial(state, input, 16, 16);
    expect(state.wisps.length).toBeLessThan(before);
    expect(events.some((e) => e.kind === "wispKilled" && e.by === "arc")).toBe(
      true,
    );
    expect(state.score).toBeGreaterThanOrEqual(trialConfig.scorePerWisp);
  });

  it("consumes a wisp inside the void core", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    const wisp = state.wisps[0];
    const input: TrialInput = {
      ...idleInput,
      voidCenter: { ...wisp.pos },
      voidRadius: 0.1,
    };
    const events = stepTrial(state, input, 16, 16);
    expect(
      events.some((e) => e.kind === "wispKilled" && e.by === "void"),
    ).toBe(true);
  });

  it("pulls wisps toward the void without consuming distant ones", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    const wisp = state.wisps[0];
    // Sit the core just inside pull reach but outside the eat radius.
    const voidRadius = 0.08;
    const input: TrialInput = {
      ...idleInput,
      voidCenter: { x: wisp.pos.x + voidRadius * 1.6, y: wisp.pos.y },
      voidRadius,
    };
    const velXBefore = wisp.vel.x;
    stepTrial(state, input, 32, 32);
    expect(wisp.vel.x).toBeGreaterThan(velXBefore);
  });

  it("blocks a hazard with the aegis ward and scores", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    state.wisps = []; // isolate hazard behavior
    state.waveBreakUntilMs = Number.MAX_SAFE_INTEGER; // freeze wave flow
    state.hazards.push({
      id: 99,
      pos: { x: 0.5, y: 0.4 },
      vel: { x: 0, y: trialConfig.hazardSpeed },
      radius: trialConfig.hazardRadius,
    });
    const input: TrialInput = {
      ...idleInput,
      aegis: { center: { x: 0.5, y: 0.42 }, radius: 0.08 },
    };
    const events = stepTrial(state, input, 16, 16);
    expect(events.some((e) => e.kind === "hazardBlocked")).toBe(true);
    expect(state.hazards).toHaveLength(0);
    expect(state.score).toBe(trialConfig.scorePerBlock);
  });

  it("loses a life when a hazard reaches the player line", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    state.waveBreakUntilMs = Number.MAX_SAFE_INTEGER;
    state.hazards.push({
      id: 99,
      pos: { x: 0.5, y: trialConfig.playerLineY - 0.001 },
      vel: { x: 0, y: trialConfig.hazardSpeed },
      radius: trialConfig.hazardRadius,
    });
    const events = stepTrial(state, idleInput, 100, 16);
    expect(events.some((e) => e.kind === "lifeLost")).toBe(true);
    expect(state.lives).toBe(trialConfig.lives - 1);
  });

  it("ends the game at zero lives", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    state.waveBreakUntilMs = Number.MAX_SAFE_INTEGER;
    state.lives = 1;
    state.hazards.push({
      id: 99,
      pos: { x: 0.5, y: trialConfig.playerLineY - 0.001 },
      vel: { x: 0, y: trialConfig.hazardSpeed },
      radius: trialConfig.hazardRadius,
    });
    const events = stepTrial(state, idleInput, 100, 16);
    expect(state.status).toBe("over");
    expect(events.some((e) => e.kind === "gameOver")).toBe(true);
  });

  it("advances to the next wave after the break", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    state.wisps = [];
    const clearedEvents = stepTrial(state, idleInput, 16, 100);
    expect(
      clearedEvents.some((e) => e.kind === "waveCleared" && e.wave === 1),
    ).toBe(true);

    stepTrial(state, idleInput, 16, 100 + trialConfig.waveBreakMs + 1);
    expect(state.wave).toBe(2);
    expect(state.wisps).toHaveLength(trialConfig.baseWisps + 1);
  });

  it("launches hazards after the grace period", () => {
    const state = startTrial(createTrial(), 0, fixedRng([0.5]));
    state.waveBreakUntilMs = Number.MAX_SAFE_INTEGER;
    expect(state.hazards).toHaveLength(0);
    stepTrial(state, idleInput, 16, trialConfig.hazardGraceMs + 1);
    expect(state.hazards).toHaveLength(1);
  });
});

describe("pointSegmentDistance", () => {
  it("measures perpendicular distance to the segment body", () => {
    const d = pointSegmentDistance(
      { x: 0.5, y: 0.6 },
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    );
    expect(d).toBeCloseTo(0.1, 5);
  });

  it("clamps to endpoints beyond the segment", () => {
    const d = pointSegmentDistance(
      { x: -0.3, y: 0.5 },
      { x: 0, y: 0.5 },
      { x: 1, y: 0.5 },
    );
    expect(d).toBeCloseTo(0.3, 5);
  });

  it("handles degenerate zero-length segments", () => {
    const d = pointSegmentDistance(
      { x: 0.4, y: 0.5 },
      { x: 0.1, y: 0.5 },
      { x: 0.1, y: 0.5 },
    );
    expect(d).toBeCloseTo(0.3, 5);
  });
});
