/**
 * Transparent PixiJS Aegis shield over the mirrored webcam.
 *
 * Each open palm toward the camera projects a screen-facing ward:
 * counter-rotating rune arcs, a breathing core disc, and orbiting motes.
 * Position/radius are EMA-smoothed per ward so each glides with its palm.
 *
 * The renderer tracks up to two wards (one per hand) so the player can
 * double-cast two wards, or a ward alongside an ember on the other hand.
 *
 * Coordinates arrive camera-normalized (0..1); renderer mirrors x for selfie.
 */

import {
  Application,
  BlurFilter,
  Container,
  Graphics,
} from "pixi.js";
import type { Vec2 } from "@/vision/types";
import { coverViewport } from "@/vision/viewport";
import { drawSparks, stepSparks, type Spark } from "./particles";

export type AegisWard = {
  /** Stable key so a ward's smoothing follows the same hand across frames. */
  key: string;
  /** Palm center (camera-normalized). */
  palm: Vec2;
  /** Palm width (camera-normalized) — scales the shield. */
  palmWidth: number;
};

export type AegisFrame = {
  /** Active wards this frame (0–2). */
  wards: AegisWard[];
};

const RING_COLOR = 0x3de0d0;
const CORE_COLOR = 0xbafff4;
const DEEP_COLOR = 0x1c7f8f;
const MOTES = 7;
const MAX_MOTES = 80;
const MOTES_PER_FRAME = 2;
const MOTE_SPAWN_MS = 40;
const MOTE_LIFE_MS = 700;

type WardState = {
  key: string;
  group: Container;
  glow: Graphics;
  rings: Graphics;
  core: Graphics;
  motes: Graphics;
  particles: Spark[];
  lastSpawnMs: number;
  target: AegisWard | null;
  smoothX: number;
  smoothY: number;
  smoothR: number;
  appear: number;
  hasAnchor: boolean;
};

export class AegisRenderer {
  private readonly app: Application;
  private readonly wards = new Map<string, WardState>();

  private frame: AegisFrame = { wards: [] };
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

  static async create(host: HTMLElement): Promise<AegisRenderer> {
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

    return new AegisRenderer(app);
  }

  update(frame: AegisFrame): void {
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

  private animate(timestamp: number): void {
    if (this.destroyed) return;
    try {
      this.renderFrame(timestamp);
    } catch {
      for (const state of this.wards.values()) state.group.visible = false;
    }
    this.rafId = requestAnimationFrame(this.animate);
  }

  private toScreen(p: Vec2): Vec2 {
    return coverViewport(
      this.videoW,
      this.videoH,
      this.app.screen.width,
      this.app.screen.height,
    ).toScreenMirrored(p);
  }

  private ensureWard(ward: AegisWard): WardState {
    const existing = this.wards.get(ward.key);
    if (existing) return existing;

    const glow = new Graphics();
    const rings = new Graphics();
    const core = new Graphics();
    const motes = new Graphics();
    for (const g of [glow, rings, core, motes]) g.blendMode = "add";
    glow.filters = [new BlurFilter({ strength: 12, quality: 3 })];

    const group = new Container();
    group.addChild(glow, rings, core, motes);
    this.app.stage.addChild(group);
    group.visible = false;

    const state: WardState = {
      key: ward.key,
      group,
      glow,
      rings,
      core,
      motes,
      particles: [],
      lastSpawnMs: 0,
      target: ward,
      smoothX: 0,
      smoothY: 0,
      smoothR: 0,
      appear: 0,
      hasAnchor: false,
    };
    this.wards.set(ward.key, state);
    return state;
  }

  private renderFrame(timestamp: number): void {
    const dt = Math.min(50, timestamp - this.lastTs) / 1000;
    this.lastTs = timestamp;

    // Reconcile tracked wards with this frame's targets.
    const seen = new Set<string>();
    for (const ward of this.frame.wards) {
      seen.add(ward.key);
      this.ensureWard(ward).target = ward;
    }
    for (const [key, state] of this.wards) {
      if (!seen.has(key)) state.target = null;
    }

    for (const state of this.wards.values()) {
      this.stepWard(state, dt);
      if (state.appear < 0.02) {
        state.group.visible = false;
        // Drop the anchor while hidden so the first visible frame snaps to
        // the palm instead of gliding in from a stale (or zero) position.
        state.hasAnchor = false;
        state.particles = [];
        continue;
      }
      state.group.visible = true;
      this.drawWard(state, timestamp, dt);
    }
  }

  private stepWard(state: WardState, dt: number): void {
    // Ward raises/lowers smoothly instead of popping.
    const target = state.target ? 1 : 0;
    const rate = state.target ? 6 : 9;
    state.appear += (target - state.appear) * Math.min(1, rate * dt);

    const ward = state.target;
    if (!ward) return;

    const p = this.toScreen(ward.palm);
    const xScale = coverViewport(
      this.videoW,
      this.videoH,
      this.app.screen.width,
      this.app.screen.height,
    ).xScale;
    const pr = Math.max(56, ward.palmWidth * xScale * 1.15);
    if (!state.hasAnchor) {
      state.smoothX = p.x;
      state.smoothY = p.y;
      state.smoothR = pr;
      state.hasAnchor = true;
    } else {
      const k = Math.min(1, 14 * dt);
      state.smoothX += (p.x - state.smoothX) * k;
      state.smoothY += (p.y - state.smoothY) * k;
      state.smoothR += (pr - state.smoothR) * Math.min(1, 8 * dt);
    }
  }

  private drawWard(state: WardState, t: number, dt: number): void {
    const glow = state.glow;
    const rings = state.rings;
    const core = state.core;
    const motes = state.motes;
    glow.clear();
    rings.clear();
    core.clear();
    motes.clear();

    const x = state.smoothX;
    const y = state.smoothY;
    const appear = state.appear;
    // Ward blooms outward while appearing.
    const r = state.smoothR * (0.6 + 0.4 * appear);
    const breathe = 1 + Math.sin(t / 480) * 0.03;
    const R = r * breathe;
    const a = appear;

    // Soft halo.
    glow.circle(x, y, R * 1.06);
    glow.fill({ color: DEEP_COLOR, alpha: 0.22 * a });

    // Core disc — translucent energy film.
    core.circle(x, y, R * 0.92);
    core.fill({ color: RING_COLOR, alpha: 0.07 * a });
    core.circle(x, y, R * 0.92);
    core.stroke({ width: 1.5, color: CORE_COLOR, alpha: 0.35 * a });

    // Counter-rotating rune arcs (outer clockwise, inner counter).
    this.arcSet(rings, x, y, R, t / 900, 3, 0.42, 3.2, RING_COLOR, 0.85 * a);
    this.arcSet(rings, x, y, R * 0.78, -t / 1300, 4, 0.3, 2.2, CORE_COLOR, 0.6 * a);

    // Rune ticks on the outer band.
    const ticks = 12;
    const spin = t / 2600;
    for (let i = 0; i < ticks; i++) {
      const ang = spin + (i / ticks) * Math.PI * 2;
      const inner = R * 1.0;
      const outer = R * (i % 3 === 0 ? 1.1 : 1.05);
      rings.moveTo(x + Math.cos(ang) * inner, y + Math.sin(ang) * inner);
      rings.lineTo(x + Math.cos(ang) * outer, y + Math.sin(ang) * outer);
      rings.stroke({ width: 2, color: RING_COLOR, alpha: 0.5 * a });
    }

    // Orbiting motes.
    for (let i = 0; i < MOTES; i++) {
      const ang = t / 700 + (i / MOTES) * Math.PI * 2;
      const wobble = Math.sin(t / 300 + i * 1.7) * R * 0.04;
      const mr = R * 0.86 + wobble;
      const mx = x + Math.cos(ang) * mr;
      const my = y + Math.sin(ang) * mr;
      core.circle(mx, my, 2.2 + (i % 3));
      core.fill({ color: CORE_COLOR, alpha: 0.7 * a });
    }

    // Pulse ring expanding every ~1.4s.
    const pulse = ((t % 1400) / 1400);
    core.circle(x, y, R * (0.5 + pulse * 0.55));
    core.stroke({
      width: 1.5,
      color: RING_COLOR,
      alpha: (1 - pulse) * 0.3 * a,
    });

    // Motes shed off the rim and drift outward.
    const now = performance.now();
    if (now - state.lastSpawnMs >= MOTE_SPAWN_MS) {
      state.lastSpawnMs = now;
      for (let i = 0; i < MOTES_PER_FRAME; i++) {
        if (state.particles.length >= MAX_MOTES) break;
        const ang = Math.random() * Math.PI * 2;
        const dist = R * (1.0 + Math.random() * 0.25);
        const sx = x + Math.cos(ang) * dist;
        const sy = y + Math.sin(ang) * dist;
        const out = 15 + Math.random() * 45;
        state.particles.push({
          x: sx,
          y: sy,
          vx: Math.cos(ang) * out + (Math.random() - 0.5) * 20,
          vy: Math.sin(ang) * out + (Math.random() - 0.5) * 20,
          life: 1,
          size: 1 + Math.random() * 2,
        });
      }
    }
    stepSparks(state.particles, dt, MOTE_LIFE_MS);
    drawSparks(motes, state.particles, CORE_COLOR, 0.9 * a);
  }

  /** Draw n evenly spaced arc segments around (x, y). */
  private arcSet(
    g: Graphics,
    x: number,
    y: number,
    radius: number,
    rotation: number,
    count: number,
    coverage: number,
    width: number,
    color: number,
    alpha: number,
  ): void {
    const span = (Math.PI * 2 * coverage) / count;
    for (let i = 0; i < count; i++) {
      const start = rotation + (i / count) * Math.PI * 2;
      g.arc(x, y, radius, start, start + span);
      g.stroke({ width, color, alpha, cap: "round" });
      // Break the path so arcs stay separate segments.
      g.moveTo(
        x + Math.cos(start + span) * radius,
        y + Math.sin(start + span) * radius,
      );
    }
  }
}
