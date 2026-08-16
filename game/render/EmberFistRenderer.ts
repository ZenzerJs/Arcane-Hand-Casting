/**
 * Transparent PixiJS layer for Ember Grasp — a molten ember that coalesces
 * around a closed fist and burns nearby trial wisps.
 *
 * Position/radius are EMA-smoothed per fist so each ember glides with its
 * fist. The renderer tracks up to two fists (one per hand) so the player can
 * double-cast two embers, or an ember alongside a ward on the other hand.
 *
 * Coordinates arrive camera-normalized (0..1); renderer mirrors x for selfie.
 */

import {
  Application,
  BlurFilter,
  Container,
  Graphics,
  Sprite,
  Texture,
} from "pixi.js";
import type { Vec2 } from "@/vision/types";
import { coverViewport } from "@/vision/viewport";
import { drawSparks, stepSparks, type Spark } from "./particles";

export type EmberFist = {
  /** Stable key so a fist's smoothing follows the same hand across frames. */
  key: string;
  /** Fist (palm center, camera-normalized). */
  fist: Vec2;
  /** Palm width (camera-normalized) — scales the ember. */
  palmWidth: number;
};

export type EmberFistFrame = {
  /** Active fists this frame (0–2). */
  fists: EmberFist[];
};

const CORE_COLOR = 0xffd1a8;
const GLOW_COLOR = 0xff7a3a;
const SPARK_COLOR = 0xffb15c;
const SPARK_COUNT = 12;
const MAX_EMBERS = 80;
const EMBERS_PER_FRAME = 2;
const EMBER_SPAWN_MS = 33;
const EMBER_LIFE_MS = 650;

function radialTexture(
  size: number,
  stops: ReadonlyArray<readonly [number, string]>,
): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return Texture.WHITE;
  const half = size / 2;
  const gradient = ctx.createRadialGradient(
    half,
    half,
    0,
    half,
    half,
    half,
  );
  for (const [offset, color] of stops) gradient.addColorStop(offset, color);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

type FistState = {
  key: string;
  root: Container;
  glow: Sprite;
  core: Graphics;
  sparks: Graphics;
  embers: Graphics;
  particles: Spark[];
  lastSpawnMs: number;
  target: EmberFist | null;
  smoothX: number;
  smoothY: number;
  smoothR: number;
  appear: number;
  hasAnchor: boolean;
};

export class EmberFistRenderer {
  private readonly app: Application;
  private readonly fists = new Map<string, FistState>();
  private readonly glowTexture: Texture;

  private frame: EmberFistFrame = { fists: [] };
  private lastTs = 0;
  private rafId = 0;
  private destroyed = false;
  private videoW = 0;
  private videoH = 0;

  private constructor(app: Application) {
    this.app = app;

    this.glowTexture = radialTexture(128, [
      [0, "rgba(255,209,168,0.95)"],
      [0.25, "rgba(255,122,58,0.85)"],
      [0.55, "rgba(255,122,58,0.28)"],
      [1, "rgba(255,122,58,0)"],
    ]);

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  static async create(host: HTMLElement): Promise<EmberFistRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
    });

    host.replaceChildren(app.canvas);
    Object.assign(app.canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none",
    });

    return new EmberFistRenderer(app);
  }

  update(frame: EmberFistFrame): void {
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

  private ensureFist(fist: EmberFist): FistState {
    const existing = this.fists.get(fist.key);
    if (existing) return existing;

    const glow = new Sprite(this.glowTexture);
    glow.anchor.set(0.5);
    glow.blendMode = "add";
    glow.filters = [new BlurFilter({ strength: 10, quality: 3 })];

    const core = new Graphics();
    const sparks = new Graphics();
    const embers = new Graphics();
    core.blendMode = "add";
    sparks.blendMode = "add";
    embers.blendMode = "add";

    const root = new Container();
    root.addChild(glow, core, sparks, embers);
    this.app.stage.addChild(root);
    root.visible = false;

    const state: FistState = {
      key: fist.key,
      root,
      glow,
      core,
      sparks,
      embers,
      particles: [],
      lastSpawnMs: 0,
      target: fist,
      smoothX: 0,
      smoothY: 0,
      smoothR: 28,
      appear: 0,
      hasAnchor: false,
    };
    this.fists.set(fist.key, state);
    return state;
  }

  private animate(timestamp: number): void {
    if (this.destroyed) return;
    try {
      this.renderFrame(timestamp);
    } catch {
      for (const state of this.fists.values()) state.root.visible = false;
    }
    this.rafId = requestAnimationFrame(this.animate);
  }

  private renderFrame(timestamp: number): void {
    const dt = Math.min(50, timestamp - this.lastTs) / 1000;
    this.lastTs = timestamp;

    // Reconcile tracked fists with this frame's targets.
    const seen = new Set<string>();
    for (const fist of this.frame.fists) {
      seen.add(fist.key);
      this.ensureFist(fist).target = fist;
    }
    for (const [key, state] of this.fists) {
      if (!seen.has(key)) state.target = null;
    }

    for (const state of this.fists.values()) {
      this.stepFist(state, dt);
      if (state.appear < 0.02) {
        state.root.visible = false;
        state.hasAnchor = false;
        state.particles = [];
        continue;
      }
      state.root.visible = true;
      this.drawFist(state, timestamp, dt);
    }
  }

  private stepFist(state: FistState, dt: number): void {
    const target = state.target ? 1 : 0;
    const rate = state.target ? 7 : 10;
    state.appear += (target - state.appear) * Math.min(1, rate * dt);

    const fist = state.target;
    if (!fist) return;

    const p = this.toScreen(fist.fist);
    const r = Math.max(24, fist.palmWidth * this.app.screen.width * 0.9);
    if (!state.hasAnchor) {
      state.smoothX = p.x;
      state.smoothY = p.y;
      state.smoothR = r;
      state.hasAnchor = true;
    } else {
      const k = Math.min(1, 14 * dt);
      state.smoothX += (p.x - state.smoothX) * k;
      state.smoothY += (p.y - state.smoothY) * k;
      state.smoothR += (r - state.smoothR) * Math.min(1, 8 * dt);
    }
  }

  private drawFist(state: FistState, t: number, dt: number): void {
    const g = state.glow;
    const core = state.core;
    const sparks = state.sparks;
    const embers = state.embers;
    core.clear();
    sparks.clear();
    embers.clear();

    const x = state.smoothX;
    const y = state.smoothY;
    const a = state.appear;
    const breathe = 1 + Math.sin(t / 420) * 0.05;
    const r = state.smoothR * (0.6 + 0.4 * a) * breathe;

    g.x = x;
    g.y = y;
    g.width = r * 4.6;
    g.height = r * 4.6;
    g.alpha = 0.75 * a;

    // Molten core: white-hot center, cooling toward the rim.
    core.circle(x, y, r);
    core.fill({ color: 0xff7a3a, alpha: 0.9 * a });
    core.circle(x, y, r * 0.62);
    core.fill({ color: 0xffb15c, alpha: 0.95 * a });
    core.circle(x, y, r * 0.3);
    core.fill({ color: CORE_COLOR, alpha: a });

    // Orbiting ember sparks.
    for (let i = 0; i < SPARK_COUNT; i++) {
      const ang = t / 620 + (i / SPARK_COUNT) * Math.PI * 2;
      const wobble = Math.sin(t / 260 + i * 1.9) * r * 0.08;
      const orbit = r * 1.25 + wobble;
      const sx = x + Math.cos(ang) * orbit;
      const sy = y + Math.sin(ang) * orbit * 0.9;
      sparks.circle(sx, sy, 1.6 + (i % 3));
      sparks.fill({ color: SPARK_COLOR, alpha: (0.35 + (i % 3) * 0.15) * a });
    }

    // Expanding heat pulse every ~1.1s.
    const pulse = (t % 1100) / 1100;
    core.circle(x, y, r * (0.5 + pulse * 0.7));
    core.stroke({
      width: 1.5,
      color: GLOW_COLOR,
      alpha: (1 - pulse) * 0.35 * a,
    });

    // Embers shed off the core and drift up + outward.
    const now = performance.now();
    if (now - state.lastSpawnMs >= EMBER_SPAWN_MS) {
      state.lastSpawnMs = now;
      for (let i = 0; i < EMBERS_PER_FRAME; i++) {
        if (state.particles.length >= MAX_EMBERS) break;
        const ang = Math.random() * Math.PI * 2;
        const dist = r * (0.85 + Math.random() * 0.35);
        const sx = x + Math.cos(ang) * dist;
        const sy = y + Math.sin(ang) * dist * 0.9;
        state.particles.push({
          x: sx,
          y: sy,
          vx:
            Math.cos(ang) * (20 + Math.random() * 50) +
            (Math.random() - 0.5) * 30,
          vy:
            Math.sin(ang) * (12 + Math.random() * 30) -
            30 -
            Math.random() * 60,
          life: 1,
          size: 1 + Math.random() * 2.4,
        });
      }
    }
    stepSparks(state.particles, dt, EMBER_LIFE_MS);
    drawSparks(embers, state.particles, SPARK_COLOR, 0.9 * a);
  }
}
