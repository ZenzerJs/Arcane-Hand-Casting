/**
 * Transparent PixiJS layer for Ember Grasp — a molten ember that coalesces
 * around a closed fist and burns nearby trial wisps.
 *
 * Position/radius are EMA-smoothed so the ember glides with the fist.
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

export type EmberFistFrame = {
  /** Fist (palm center, camera-normalized) or null when the ember is down. */
  fist: Vec2 | null;
  /** Palm width (camera-normalized) — scales the ember. */
  palmWidth: number;
};

const CORE_COLOR = 0xffd1a8;
const GLOW_COLOR = 0xff7a3a;
const SPARK_COLOR = 0xffb15c;
const SPARK_COUNT = 12;

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

export class EmberFistRenderer {
  private readonly app: Application;
  private readonly root = new Container();
  private readonly glow = new Sprite();
  private readonly core = new Graphics();
  private readonly sparks = new Graphics();

  private frame: EmberFistFrame = { fist: null, palmWidth: 0.2 };
  private smoothX = 0;
  private smoothY = 0;
  private smoothR = 28;
  private appear = 0;
  private hasAnchor = false;
  private lastTs = 0;
  private rafId = 0;
  private destroyed = false;
  private videoW = 0;
  private videoH = 0;

  private constructor(app: Application) {
    this.app = app;

    this.glow.texture = radialTexture(128, [
      [0, "rgba(255,209,168,0.95)"],
      [0.25, "rgba(255,122,58,0.85)"],
      [0.55, "rgba(255,122,58,0.28)"],
      [1, "rgba(255,122,58,0)"],
    ]);
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.glow.filters = [new BlurFilter({ strength: 10, quality: 3 })];

    this.core.blendMode = "add";
    this.sparks.blendMode = "add";

    this.root.addChild(this.glow, this.core, this.sparks);
    this.app.stage.addChild(this.root);
    this.root.visible = false;

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

  private animate(timestamp: number): void {
    if (this.destroyed) return;
    try {
      this.renderFrame(timestamp);
    } catch {
      this.root.visible = false;
    }
    this.rafId = requestAnimationFrame(this.animate);
  }

  private renderFrame(timestamp: number): void {
    const dt = Math.min(50, timestamp - this.lastTs) / 1000;
    this.lastTs = timestamp;

    const { fist, palmWidth } = this.frame;

    const target = fist ? 1 : 0;
    const rate = fist ? 7 : 10;
    this.appear += (target - this.appear) * Math.min(1, rate * dt);

    if (this.appear < 0.02) {
      this.root.visible = false;
      this.hasAnchor = false;
      return;
    }

    if (fist) {
      const p = this.toScreen(fist);
      const r = Math.max(24, palmWidth * this.app.screen.width * 0.9);
      if (!this.hasAnchor) {
        this.smoothX = p.x;
        this.smoothY = p.y;
        this.smoothR = r;
        this.hasAnchor = true;
      } else {
        const k = Math.min(1, 14 * dt);
        this.smoothX += (p.x - this.smoothX) * k;
        this.smoothY += (p.y - this.smoothY) * k;
        this.smoothR += (r - this.smoothR) * Math.min(1, 8 * dt);
      }
    }

    this.root.visible = true;
    this.draw(timestamp);
  }

  private draw(t: number): void {
    const g = this.glow;
    const core = this.core;
    const sparks = this.sparks;
    core.clear();
    sparks.clear();

    const x = this.smoothX;
    const y = this.smoothY;
    const a = this.appear;
    const breathe = 1 + Math.sin(t / 420) * 0.05;
    const r = this.smoothR * (0.6 + 0.4 * a) * breathe;

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
  }
}
