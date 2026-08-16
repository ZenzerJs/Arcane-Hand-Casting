/**
 * Stage 8 trial mode — pure wave logic, no Pixi/React.
 *
 * Wisps (rune targets) drift around the camera frame. The player destroys
 * them with live spells; hazard bolts dive at the bottom of the frame and
 * must be blocked with the Aegis ward or a life is lost.
 *
 *   - Storm Weave arcs kill wisps near any tip↔tip segment
 *   - Void Singularity pulls nearby wisps in and consumes them at the core
 *   - Aegis ward intersecting a hazard destroys it (+block score)
 *
 * All coordinates camera-normalized (0..1, x un-mirrored) so this stays
 * renderer-agnostic and unit-testable. Renderer mirrors x like the others.
 */

import type { Vec2 } from "@/vision/types";

export const trialConfig = {
  lives: 3,
  /** Wave n spawns baseWisps + n - 1 wisps. */
  baseWisps: 3,
  maxWisps: 9,
  wispRadius: 0.032,
  /** Wisp drift speed (normalized units per second). */
  wispSpeed: 0.05,
  /** Distance from a lightning segment that counts as a hit. */
  arcHitWidth: 0.02,
  /** Void pull reaches this many core radii out. */
  voidPullReach: 2.1,
  /** Wisps inside this fraction of core radius are consumed. */
  voidEatFraction: 0.75,
  /** Wisps inside this fraction of the ember burn radius are incinerated. */
  emberEatFraction: 0.9,
  /** Pull acceleration toward the singularity (normalized/s²). */
  voidPullAccel: 0.55,
  hazardRadius: 0.024,
  hazardSpeed: 0.16,
  /** Ms between hazard launches once a trial is running. */
  hazardIntervalMs: 3600,
  /** First hazard grace period after starting a wave. */
  hazardGraceMs: 4500,
  /** Hazards crossing below this y reach the player. */
  playerLineY: 0.94,
  /** Pause between clearing a wave and the next spawn. */
  waveBreakMs: 1400,
  scorePerWisp: 100,
  scorePerBlock: 50,
} as const;

export type Wisp = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
};

export type Hazard = {
  id: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
};

export type TrialStatus = "idle" | "running" | "over";

export type TrialState = {
  status: TrialStatus;
  wave: number;
  score: number;
  lives: number;
  wisps: Wisp[];
  hazards: Hazard[];
  nextHazardAtMs: number;
  /** Set while waiting between waves; next wave spawns after it passes. */
  waveBreakUntilMs: number | null;
  nextId: number;
};

/** What the player's hands are doing this tick. */
export type TrialInput = {
  /** Void Singularity core (normalized) or null. */
  voidCenter: Vec2 | null;
  /** Void core radius in normalized units. */
  voidRadius: number;
  /** Live tip↔tip lightning segments (arcs only, not flickers). */
  arcs: ReadonlyArray<{ from: Vec2; to: Vec2 }>;
  /** Aegis ward disc or null. */
  aegis: { center: Vec2; radius: number } | null;
  /** Ember Grasp fist (normalized) or null. */
  ember: { center: Vec2; radius: number } | null;
};

export type TrialEvent =
  | { kind: "wispKilled"; pos: Vec2; by: "arc" | "void" | "ember" }
  | { kind: "hazardBlocked"; pos: Vec2 }
  | { kind: "lifeLost"; pos: Vec2 }
  | { kind: "waveCleared"; wave: number }
  | { kind: "gameOver"; score: number };

export type Rng = () => number;

export function createTrial(): TrialState {
  return {
    status: "idle",
    wave: 0,
    score: 0,
    lives: trialConfig.lives,
    wisps: [],
    hazards: [],
    nextHazardAtMs: 0,
    waveBreakUntilMs: null,
    nextId: 1,
  };
}

export function startTrial(
  state: TrialState,
  nowMs: number,
  rng: Rng = Math.random,
): TrialState {
  const fresh = createTrial();
  fresh.status = "running";
  fresh.wave = 1;
  fresh.nextHazardAtMs = nowMs + trialConfig.hazardGraceMs;
  spawnWave(fresh, rng);
  return fresh;
}

/**
 * Advance one tick. Mutates and returns `state`; events describe what
 * happened so the renderer can spawn bursts without diffing snapshots.
 */
export function stepTrial(
  state: TrialState,
  input: TrialInput,
  dtMs: number,
  nowMs: number,
  rng: Rng = Math.random,
): TrialEvent[] {
  if (state.status !== "running") return [];

  const events: TrialEvent[] = [];
  const dt = Math.min(dtMs, 100) / 1000;

  moveWisps(state, input, dt);
  killWisps(state, input, events);
  stepHazards(state, input, dt, events);
  launchHazard(state, nowMs, rng);

  if (state.lives <= 0) {
    state.status = "over";
    state.hazards = [];
    events.push({ kind: "gameOver", score: state.score });
    return events;
  }

  // Wave flow: clear → short break → next wave.
  if (state.wisps.length === 0 && state.waveBreakUntilMs === null) {
    events.push({ kind: "waveCleared", wave: state.wave });
    state.waveBreakUntilMs = nowMs + trialConfig.waveBreakMs;
  }
  if (
    state.waveBreakUntilMs !== null &&
    nowMs >= state.waveBreakUntilMs
  ) {
    state.waveBreakUntilMs = null;
    state.wave += 1;
    spawnWave(state, rng);
  }

  return events;
}

function spawnWave(state: TrialState, rng: Rng): void {
  const count = Math.min(
    trialConfig.maxWisps,
    trialConfig.baseWisps + state.wave - 1,
  );
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    state.wisps.push({
      id: state.nextId++,
      pos: {
        x: 0.15 + rng() * 0.7,
        y: 0.12 + rng() * 0.55,
      },
      vel: {
        x: Math.cos(angle) * trialConfig.wispSpeed,
        y: Math.sin(angle) * trialConfig.wispSpeed,
      },
      radius: trialConfig.wispRadius,
    });
  }
}

function moveWisps(state: TrialState, input: TrialInput, dt: number): void {
  for (const wisp of state.wisps) {
    // Void gravity: accelerate toward the core while inside pull reach.
    if (input.voidCenter && input.voidRadius > 0) {
      const dx = input.voidCenter.x - wisp.pos.x;
      const dy = input.voidCenter.y - wisp.pos.y;
      const d = Math.hypot(dx, dy);
      const reach = input.voidRadius * trialConfig.voidPullReach;
      if (d > 1e-6 && d < reach) {
        const pull = trialConfig.voidPullAccel * (1 - d / reach);
        wisp.vel.x += (dx / d) * pull * dt;
        wisp.vel.y += (dy / d) * pull * dt;
      }
    }

    wisp.pos.x += wisp.vel.x * dt;
    wisp.pos.y += wisp.vel.y * dt;

    // Bounce off frame edges.
    if (wisp.pos.x < 0.05 || wisp.pos.x > 0.95) {
      wisp.vel.x *= -1;
      wisp.pos.x = Math.min(0.95, Math.max(0.05, wisp.pos.x));
    }
    if (wisp.pos.y < 0.06 || wisp.pos.y > 0.8) {
      wisp.vel.y *= -1;
      wisp.pos.y = Math.min(0.8, Math.max(0.06, wisp.pos.y));
    }
  }
}

function killWisps(
  state: TrialState,
  input: TrialInput,
  events: TrialEvent[],
): void {
  state.wisps = state.wisps.filter((wisp) => {
    // Consumed by the singularity core.
    if (input.voidCenter && input.voidRadius > 0) {
      const d = Math.hypot(
        wisp.pos.x - input.voidCenter.x,
        wisp.pos.y - input.voidCenter.y,
      );
      if (d < input.voidRadius * trialConfig.voidEatFraction + wisp.radius) {
        state.score += trialConfig.scorePerWisp;
        events.push({ kind: "wispKilled", pos: { ...wisp.pos }, by: "void" });
        return false;
      }
    }

    // Incinerated by the ember grasp.
    if (input.ember) {
      const d = Math.hypot(
        wisp.pos.x - input.ember.center.x,
        wisp.pos.y - input.ember.center.y,
      );
      if (d < input.ember.radius * trialConfig.emberEatFraction + wisp.radius) {
        state.score += trialConfig.scorePerWisp;
        events.push({ kind: "wispKilled", pos: { ...wisp.pos }, by: "ember" });
        return false;
      }
    }

    // Struck by a lightning arc.
    for (const arc of input.arcs) {
      const d = pointSegmentDistance(wisp.pos, arc.from, arc.to);
      if (d < wisp.radius + trialConfig.arcHitWidth) {
        state.score += trialConfig.scorePerWisp;
        events.push({ kind: "wispKilled", pos: { ...wisp.pos }, by: "arc" });
        return false;
      }
    }

    return true;
  });
}

function stepHazards(
  state: TrialState,
  input: TrialInput,
  dt: number,
  events: TrialEvent[],
): void {
  state.hazards = state.hazards.filter((hazard) => {
    hazard.pos.x += hazard.vel.x * dt;
    hazard.pos.y += hazard.vel.y * dt;

    // Blocked by the ward.
    if (input.aegis) {
      const d = Math.hypot(
        hazard.pos.x - input.aegis.center.x,
        hazard.pos.y - input.aegis.center.y,
      );
      if (d < input.aegis.radius + hazard.radius) {
        state.score += trialConfig.scorePerBlock;
        events.push({ kind: "hazardBlocked", pos: { ...hazard.pos } });
        return false;
      }
    }

    // Reached the player line.
    if (hazard.pos.y >= trialConfig.playerLineY) {
      state.lives -= 1;
      events.push({ kind: "lifeLost", pos: { ...hazard.pos } });
      return false;
    }

    return true;
  });
}

function launchHazard(state: TrialState, nowMs: number, rng: Rng): void {
  if (nowMs < state.nextHazardAtMs) return;
  state.nextHazardAtMs = nowMs + trialConfig.hazardIntervalMs;

  const startX = 0.15 + rng() * 0.7;
  const target: Vec2 = { x: 0.35 + rng() * 0.3, y: trialConfig.playerLineY };
  const dx = target.x - startX;
  const dy = target.y - -0.05;
  const mag = Math.hypot(dx, dy) || 1;
  state.hazards.push({
    id: state.nextId++,
    pos: { x: startX, y: -0.05 },
    vel: {
      x: (dx / mag) * trialConfig.hazardSpeed,
      y: (dy / mag) * trialConfig.hazardSpeed,
    },
    radius: trialConfig.hazardRadius,
  });
}

/** Distance from point p to segment ab. */
export function pointSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const lenSq = abx * abx + aby * aby;
  if (lenSq < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}
