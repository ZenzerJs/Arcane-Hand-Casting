/**
 * Transparent PixiJS Aegis shield over the mirrored webcam.
 *
 * One open palm toward the camera projects a screen-facing ward:
 * counter-rotating rune arcs, a breathing core disc, and orbiting motes.
 * Position/radius are EMA-smoothed so the ward glides with the palm.
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

export type AegisFrame = {
  /** Palm center (camera-normalized) or null when the ward is down. */
  palm: Vec2 | null;
  /** Palm width (camera-normalized) — scales the shield. */
  palmWidth: number;
};

const RING_COLOR = 0x3de0d0;
const CORE_COLOR = 0xbafff4;
const DEEP_COLOR = 0x1c7f8f;
const MOTES = 7;

export class AegisRenderer {
  private readonly app: Application;
  private readonly group = new Container();
  private readonly glow = new Graphics();
  private readonly rings = new Graphics();
  private readonly core = new Graphics();

  private frame: AegisFrame = { palm: null, palmWidth: 0.2 };
  private smoothX = 0;
  private smoothY = 0;
  private smoothR = 0;
  private appear = 0;
  private hasAnchor = false;
  private lastTs = 0;
  private rafId = 0;
  private destroyed = false;
  private videoW = 0;
  private videoH = 0;

  private constructor(app: Application) {
    this.app = app;

    for (const g of [this.glow, this.rings, this.core]) {
      g.blendMode = "add";
    }
    this.glow.filters = [new BlurFilter({ strength: 12, quality: 3 })];

    this.group.addChild(this.glow, this.rings, this.core);
    this.app.stage.addChild(this.group);
    this.group.visible = false;

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
      this.group.visible = false;
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

  private renderFrame(timestamp: number): void {
    const dt = Math.min(50, timestamp - this.lastTs) / 1000;
    this.lastTs = timestamp;

    const { palm, palmWidth } = this.frame;

    // Ward raises/lowers smoothly instead of popping.
    const target = palm ? 1 : 0;
    const rate = palm ? 6 : 9;
    this.appear += (target - this.appear) * Math.min(1, rate * dt);

    if (this.appear < 0.02) {
      this.group.visible = false;
      // Drop the anchor while hidden so the first visible frame snaps to the
      // palm instead of gliding in from a stale (or zero) position.
      this.hasAnchor = false;
      return;
    }

    if (palm) {
      const p = this.toScreen(palm);
      const px = p.x;
      const py = p.y;
      const xScale = coverViewport(
        this.videoW,
        this.videoH,
        this.app.screen.width,
        this.app.screen.height,
      ).xScale;
      const pr = Math.max(56, palmWidth * xScale * 1.15);
      if (!this.hasAnchor) {
        this.smoothX = px;
        this.smoothY = py;
        this.smoothR = pr;
        this.hasAnchor = true;
      } else {
        const k = Math.min(1, 14 * dt);
        this.smoothX += (px - this.smoothX) * k;
        this.smoothY += (py - this.smoothY) * k;
        this.smoothR += (pr - this.smoothR) * Math.min(1, 8 * dt);
      }
    }

    this.group.visible = true;
    this.draw(timestamp);
  }

  private draw(t: number): void {
    const g = this.glow;
    const rings = this.rings;
    const core = this.core;
    g.clear();
    rings.clear();
    core.clear();

    const x = this.smoothX;
    const y = this.smoothY;
    const appear = this.appear;
    // Ward blooms outward while appearing.
    const r = this.smoothR * (0.6 + 0.4 * appear);
    const breathe = 1 + Math.sin(t / 480) * 0.03;
    const R = r * breathe;
    const a = appear;

    // Soft halo.
    g.circle(x, y, R * 1.06);
    g.fill({ color: DEEP_COLOR, alpha: 0.22 * a });

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
