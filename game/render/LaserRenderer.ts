/**
 * Transparent PixiJS layer for Arcane Laser — a gun hand (index finger out,
 * thumb cocked) fires an intertwined double-helix beam from the fingertip
 * along the pointing direction.
 *
 * The beam is two counter-rotating strands (not a single line) that spiral
 * around the pointing axis and flow outward, with spark particles shedding
 * off the beam and drifting away.
 *
 * Tracks up to two beams (one per gun hand). Origin and direction are
 * EMA-smoothed so the beam glides with the finger instead of jittering.
 *
 * Coordinates arrive camera-normalized (0..1); renderer mirrors x for selfie.
 */

import { Application, BlurFilter, Container, Graphics } from "pixi.js";
import type { Vec2 } from "@/vision/types";
import { coverViewport } from "@/vision/viewport";

export type LaserBeam = {
  /** Stable key so a beam follows the same hand across frames. */
  key: string;
  /** Index fingertip (camera-normalized). */
  from: Vec2;
  /** Beam end projected along the index direction (camera-normalized). */
  to: Vec2;
};

export type LaserFrame = {
  /** Active beams this frame (0–2). */
  beams: LaserBeam[];
};

const CORE_COLOR = 0xfff0ff;
const GLOW_COLOR = 0xff5ce1;
const SPARK_COLOR = 0xffb3f2;

/** Radius of each helix around the pointing axis (px). */
const SPIRAL_RADIUS = 7;
/** How tightly the strands wind around the axis (rad per px). */
const SPIRAL_TWIST = 0.045;
/** Rotation speed of the whole spiral (rad per ms) — energy flowing outward. */
const SPIRAL_FLOW = 0.0035;
/** Sample spacing along the beam (px) for the helix polylines. */
const STEP_PX = 16;

const MAX_PARTICLES = 90;
const SPARKS_PER_FRAME = 3;
const PARTICLE_LIFE_MS = 550;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** 1 → 0; removed at 0. */
  life: number;
  size: number;
};

type BeamState = {
  key: string;
  group: Container;
  glow: Graphics;
  core: Graphics;
  sparks: Graphics;
  particles: Particle[];
  lastSpawnMs: number;
  target: LaserBeam | null;
  smoothX: number;
  smoothY: number;
  dirX: number;
  dirY: number;
  appear: number;
  hasAnchor: boolean;
};

export class LaserRenderer {
  private readonly app: Application;
  private readonly beams = new Map<string, BeamState>();

  private frame: LaserFrame = { beams: [] };
  private lastTs = 0;
  private rafId = 0;
  private destroyed = false;
  private videoW = 0;
  private videoH = 0;

  private constructor(app: Application) {
    this.app = app;
    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  static async create(host: HTMLElement): Promise<LaserRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      clearBeforeRender: true,
    });

    host.replaceChildren(app.canvas);
    Object.assign(app.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });

    return new LaserRenderer(app);
  }

  update(frame: LaserFrame): void {
    this.frame = frame;
  }

  /** Keep overlays aligned with the `object-cover`-cropped video. */
  setVideoSize(width: number, height: number): void {
    this.videoW = width;
    this.videoH = height;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.app.destroy(true, { children: true });
  }

  private toScreen(p: Vec2): Vec2 {
    return coverViewport(
      this.videoW,
      this.videoH,
      this.app.screen.width,
      this.app.screen.height,
    ).toScreenMirrored(p);
  }

  private ensureBeam(beam: LaserBeam): BeamState {
    const existing = this.beams.get(beam.key);
    if (existing) return existing;

    const glow = new Graphics();
    const core = new Graphics();
    const sparks = new Graphics();
    glow.blendMode = "add";
    core.blendMode = "add";
    sparks.blendMode = "add";
    glow.filters = [new BlurFilter({ strength: 8, quality: 3 })];

    const group = new Container();
    group.addChild(glow, core, sparks);
    this.app.stage.addChild(group);
    group.visible = false;

    const state: BeamState = {
      key: beam.key,
      group,
      glow,
      core,
      sparks,
      particles: [],
      lastSpawnMs: 0,
      target: beam,
      smoothX: 0,
      smoothY: 0,
      dirX: 1,
      dirY: 0,
      appear: 0,
      hasAnchor: false,
    };
    this.beams.set(beam.key, state);
    return state;
  }

  private animate(timestamp: number): void {
    if (this.destroyed) return;
    try {
      this.renderFrame(timestamp);
    } catch {
      for (const state of this.beams.values()) state.group.visible = false;
    }
    this.rafId = requestAnimationFrame(this.animate);
  }

  private renderFrame(timestamp: number): void {
    const dt = Math.min(50, timestamp - this.lastTs) / 1000;
    this.lastTs = timestamp;

    // Reconcile tracked beams with this frame's targets.
    const seen = new Set<string>();
    for (const beam of this.frame.beams) {
      seen.add(beam.key);
      this.ensureBeam(beam).target = beam;
    }
    for (const [key, state] of this.beams) {
      if (!seen.has(key)) state.target = null;
    }

    for (const state of this.beams.values()) {
      this.stepBeam(state, dt);
      if (state.appear < 0.02) {
        state.group.visible = false;
        state.hasAnchor = false;
        state.particles = [];
        continue;
      }
      state.group.visible = true;
      this.drawBeam(state, timestamp, dt);
    }
  }

  private stepBeam(state: BeamState, dt: number): void {
    const target = state.target ? 1 : 0;
    const rate = state.target ? 14 : 12;
    state.appear += (target - state.appear) * Math.min(1, rate * dt);

    const beam = state.target;
    if (!beam) return;

    const p = this.toScreen(beam.from);
    const q = this.toScreen(beam.to);
    let dx = q.x - p.x;
    let dy = q.y - p.y;
    const mag = Math.hypot(dx, dy) || 1;
    dx /= mag;
    dy /= mag;

    if (!state.hasAnchor) {
      state.smoothX = p.x;
      state.smoothY = p.y;
      state.dirX = dx;
      state.dirY = dy;
      state.hasAnchor = true;
    } else {
      const k = Math.min(1, 16 * dt);
      state.smoothX += (p.x - state.smoothX) * k;
      state.smoothY += (p.y - state.smoothY) * k;
      const kd = Math.min(1, 10 * dt);
      state.dirX += (dx - state.dirX) * kd;
      state.dirY += (dy - state.dirY) * kd;
      const dm = Math.hypot(state.dirX, state.dirY) || 1;
      state.dirX /= dm;
      state.dirY /= dm;
    }
  }

  private drawBeam(state: BeamState, t: number, dt: number): void {
    const glow = state.glow;
    const core = state.core;
    const sparks = state.sparks;
    glow.clear();
    core.clear();
    sparks.clear();

    const a = state.appear;
    const ox = state.smoothX;
    const oy = state.smoothY;
    const dx = state.dirX;
    const dy = state.dirY;
    // Perpendicular to the beam — the axis each helix winds around.
    const nx = -dy;
    const ny = dx;
    const reach =
      Math.hypot(this.app.screen.width, this.app.screen.height) * 1.25;
    const R = SPIRAL_RADIUS * a;

    // Two intertwined strands, half a turn apart.
    const phase = t * SPIRAL_FLOW;
    this.drawHelix(
      glow,
      ox, oy, dx, dy, nx, ny, reach, R, phase,
      11 * a, GLOW_COLOR, 0.4 * a,
    );
    this.drawHelix(
      glow,
      ox, oy, dx, dy, nx, ny, reach, R, phase + Math.PI,
      11 * a, GLOW_COLOR, 0.4 * a,
    );
    this.drawHelix(
      core,
      ox, oy, dx, dy, nx, ny, reach, R, phase,
      2.6 * a, CORE_COLOR, 0.9 * a,
    );
    this.drawHelix(
      core,
      ox, oy, dx, dy, nx, ny, reach, R, phase + Math.PI,
      2.6 * a, CORE_COLOR, 0.9 * a,
    );

    // Muzzle flare at the fingertip.
    core.circle(ox, oy, 6 * a);
    core.fill({ color: CORE_COLOR, alpha: a });
    glow.circle(ox, oy, 13 * a);
    glow.fill({ color: GLOW_COLOR, alpha: 0.4 * a });

    // Sparks shed off the beam and drift outward.
    this.spawnParticles(state, ox, oy, dx, dy, nx, ny, reach, R);
    this.stepParticles(state, dt);
    for (const p of state.particles) {
      sparks.circle(p.x, p.y, p.size);
      sparks.fill({ color: SPARK_COLOR, alpha: p.life * 0.9 * a });
    }
  }

  /** One strand of the double helix: a spiral polyline along the beam. */
  private drawHelix(
    g: Graphics,
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    nx: number,
    ny: number,
    reach: number,
    R: number,
    phase: number,
    width: number,
    color: number,
    alpha: number,
  ): void {
    g.moveTo(
      ox + nx * R * Math.cos(phase),
      oy + ny * R * Math.sin(phase),
    );
    for (let dist = STEP_PX; dist <= reach; dist += STEP_PX) {
      const ang = phase + dist * SPIRAL_TWIST;
      const wobble = 0.75 + 0.25 * Math.sin(dist * 0.0022);
      const r = R * wobble;
      g.lineTo(
        ox + dx * dist + nx * r * Math.cos(ang),
        oy + dy * dist + ny * r * Math.sin(ang),
      );
    }
    g.stroke({ width, color, alpha, cap: "round" });
  }

  private spawnParticles(
    state: BeamState,
    ox: number,
    oy: number,
    dx: number,
    dy: number,
    nx: number,
    ny: number,
    reach: number,
    R: number,
  ): void {
    const now = performance.now();
    if (now - state.lastSpawnMs < 33) return;
    state.lastSpawnMs = now;

    for (let i = 0; i < SPARKS_PER_FRAME; i++) {
      if (state.particles.length >= MAX_PARTICLES) return;
      const dist = Math.random() * reach;
      const ang = Math.random() * Math.PI * 2;
      const bx = ox + dx * dist + nx * R * Math.cos(ang);
      const by = oy + dy * dist + ny * R * Math.sin(ang);
      const outward = 25 + Math.random() * 70;
      const side = Math.random() < 0.5 ? -1 : 1;
      state.particles.push({
        x: bx,
        y: by,
        vx: nx * outward * side + dx * (Math.random() - 0.5) * 40,
        vy: ny * outward * side + dy * (Math.random() - 0.5) * 40,
        life: 1,
        size: 1 + Math.random() * 2.2,
      });
    }
  }

  private stepParticles(state: BeamState, dt: number): void {
    const decay = dt / (PARTICLE_LIFE_MS / 1000);
    for (const p of state.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.98;
      p.vy *= 0.98;
      p.life -= decay;
    }
    state.particles = state.particles.filter((p) => p.life > 0);
  }
}
