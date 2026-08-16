/**
 * Transparent PixiJS black hole rendered between mirrored webcam palms.
 *
 * Layers: gravitational glow → rear accretion disk → black event horizon →
 * foreground disk/lensing ring → infalling matter. Geometry is procedural.
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

export type CameraFireballFrame = {
  /** Two raw camera-space palm centers. Renderer mirrors x for selfie view. */
  palms: readonly [Vec2, Vec2] | null;
};

type Matter = {
  phase: number;
  band: number;
  speed: number;
  size: number;
};

const MATTER_COUNT = 34;
const ACCRETION_COLORS = [
  0xff7a3a, // hot orange
  0xffb15c, // incandescent amber
  0x8b6cff, // arcane violet
  0xc5b8ff, // lensing lavender
];

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

export class CameraFireballRenderer {
  private readonly app: Application;
  private readonly root = new Container();
  private readonly halo = new Sprite();
  private readonly rearDisk = new Graphics();
  private readonly horizon = new Graphics();
  private readonly frontDisk = new Graphics();
  private readonly lens = new Graphics();
  private readonly matter = new Graphics();
  private readonly matterSeeds: Matter[] = [];

  private frame: CameraFireballFrame = { palms: null };
  private smoothX = 0;
  private smoothY = 0;
  private smoothIntensity = 0;
  private smoothRadius = 20;
  private appear = 0;
  private hasPosition = false;
  private lastTimestamp = performance.now();
  private rafId = 0;
  private destroyed = false;
  private videoW = 0;
  private videoH = 0;

  private constructor(app: Application) {
    this.app = app;

    this.halo.texture = radialTexture(256, [
      [0, "rgba(8,5,20,0)"],
      [0.18, "rgba(255,106,42,0.08)"],
      [0.31, "rgba(255,122,58,0.82)"],
      [0.43, "rgba(177,88,255,0.66)"],
      [0.58, "rgba(106,91,255,0.26)"],
      [0.8, "rgba(43,19,105,0.08)"],
      [1, "rgba(8,5,30,0)"],
    ]);
    this.halo.anchor.set(0.5);
    this.halo.blendMode = "add";
    this.halo.filters = [new BlurFilter({ strength: 12, quality: 3 })];

    for (const g of [this.rearDisk, this.frontDisk, this.lens, this.matter]) {
      g.blendMode = "add";
    }

    for (let i = 0; i < MATTER_COUNT; i++) {
      this.matterSeeds.push({
        phase: i * 2.39996,
        band: (i % 7) / 7,
        speed: 0.00022 + (i % 6) * 0.000035,
        size: 1.2 + (i % 4) * 0.65,
      });
    }

    this.root.addChild(
      this.halo,
      this.rearDisk,
      this.horizon,
      this.frontDisk,
      this.lens,
      this.matter,
    );
    this.app.stage.addChild(this.root);
    this.root.visible = false;

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  static async create(host: HTMLElement): Promise<CameraFireballRenderer> {
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
    return new CameraFireballRenderer(app);
  }

  update(frame: CameraFireballFrame): void {
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
      this.root.visible = false;
    }
    this.rafId = requestAnimationFrame(this.animate);
  }

  private renderFrame(timestamp: number): void {
    const deltaMs = Math.min(50, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;
    const palms = this.frame.palms;
    const targetAppear = palms ? 1 : 0;
    this.appear +=
      (targetAppear - this.appear) *
      Math.min(1, (palms ? 7 : 10) * (deltaMs / 1000));

    if (palms) {
      const [a, b] = palms;
      const ax = this.toScreen(a).x;
      const ay = this.toScreen(a).y;
      const bx = this.toScreen(b).x;
      const by = this.toScreen(b).y;
      const targetX = (ax + bx) / 2;
      const targetY = (ay + by) / 2;
      const gap = Math.hypot(bx - ax, by - ay);
      const targetRadius = Math.max(18, gap * 0.22);
      const reference =
        Math.min(this.app.screen.width, this.app.screen.height) * 0.22;
      const targetIntensity = Math.min(1, targetRadius / Math.max(reference, 1));

      if (!this.hasPosition) {
        this.smoothX = targetX;
        this.smoothY = targetY;
        this.smoothRadius = targetRadius;
        this.smoothIntensity = targetIntensity;
        this.hasPosition = true;
      } else {
        this.smoothX += (targetX - this.smoothX) * 0.32;
        this.smoothY += (targetY - this.smoothY) * 0.32;
        this.smoothRadius += (targetRadius - this.smoothRadius) * 0.2;
        this.smoothIntensity +=
          (targetIntensity - this.smoothIntensity) * 0.18;
      }
    }

    if (this.appear < 0.015) {
      this.root.visible = false;
      this.hasPosition = false;
      return;
    }

    this.root.visible = true;
    this.root.x = this.smoothX;
    this.root.y = this.smoothY;
    this.root.scale.set(0.65 + this.appear * 0.35);
    this.root.alpha = Math.min(1, this.appear * 1.25);
    this.drawBlackHole(timestamp);
  }

  private toScreen(p: Vec2): Vec2 {
    return coverViewport(
      this.videoW,
      this.videoH,
      this.app.screen.width,
      this.app.screen.height,
    ).toScreenMirrored(p);
  }

  private drawBlackHole(timestamp: number): void {
    const r = this.smoothRadius;
    const intensity = 0.65 + this.smoothIntensity * 0.35;
    const breathe = 1 + Math.sin(timestamp * 0.0024) * 0.025;
    const eventR = r * 0.72 * breathe;
    const diskR = r * 1.9;
    const tilt = 0.3;
    const rotation = -0.16;

    this.rearDisk.clear();
    this.horizon.clear();
    this.frontDisk.clear();
    this.lens.clear();
    this.matter.clear();

    this.halo.width = r * 5.8;
    this.halo.height = r * 5.8;
    this.halo.alpha = 0.65 * intensity;
    this.halo.rotation = timestamp * 0.00009;

    // Rear accretion stream disappears behind event horizon.
    for (let i = 0; i < 18; i++) {
      const start = Math.PI + (i / 18) * Math.PI;
      const span = 0.08 + (i % 4) * 0.025;
      const color = ACCRETION_COLORS[i % ACCRETION_COLORS.length];
      drawEllipseArc(
        this.rearDisk,
        diskR * (0.82 + (i % 3) * 0.1),
        tilt,
        start + timestamp * (0.00055 + (i % 3) * 0.00008),
        span,
        rotation,
        2 + (i % 3),
        color,
        (0.35 + (i % 4) * 0.1) * intensity,
      );
    }

    // Absolute black center remains opaque over bright camera footage.
    this.horizon.circle(0, 0, eventR * 1.05);
    this.horizon.fill({ color: 0x020207, alpha: 0.96 });
    this.horizon.circle(0, 0, eventR);
    this.horizon.fill({ color: 0x000000, alpha: 1 });

    // Foreground stream wraps over lower half: gravitational lens illusion.
    for (let i = 0; i < 22; i++) {
      const start = (i / 22) * Math.PI;
      const span = 0.065 + (i % 5) * 0.018;
      const color = ACCRETION_COLORS[(i + 1) % ACCRETION_COLORS.length];
      drawEllipseArc(
        this.frontDisk,
        diskR * (0.78 + (i % 4) * 0.085),
        tilt,
        start + timestamp * (0.00068 + (i % 4) * 0.00007),
        span,
        rotation,
        2.2 + (i % 3),
        color,
        (0.48 + (i % 4) * 0.1) * intensity,
      );
    }

    // Event horizon: razor-hot orange photon ring, then violet lensing bands.
    // Multiple thin rings produce chromatic gravitational distortion without
    // softening the absolute-black center.
    this.lens.circle(0, 0, eventR * 1.075);
    this.lens.stroke({
      width: Math.max(2.2, r * 0.065),
      color: 0xff7a3a,
      alpha: 0.98 * intensity,
    });
    this.lens.circle(0, 0, eventR * 1.13);
    this.lens.stroke({
      width: Math.max(1.2, r * 0.032),
      color: 0xffb15c,
      alpha: 0.72 * intensity,
    });
    this.lens.circle(0, 0, eventR * 1.22);
    this.lens.stroke({
      width: Math.max(1.4, r * 0.038),
      color: 0x8b6cff,
      alpha: 0.68 * intensity,
    });
    this.lens.circle(0, 0, eventR * 1.38);
    this.lens.stroke({
      width: Math.max(0.8, r * 0.018),
      color: 0xc5b8ff,
      alpha: 0.3 * intensity,
    });

    // Matter spirals inward. Short trailing strokes show pull direction.
    for (let i = 0; i < this.matterSeeds.length; i++) {
      const seed = this.matterSeeds[i];
      const cycle = ((timestamp * seed.speed + seed.band) % 1 + 1) % 1;
      const radial = eventR * (1.2 + (1 - cycle) * 1.85);
      const angle = seed.phase + timestamp * seed.speed * 7 + cycle * 7;
      const x = Math.cos(angle) * radial;
      const y = Math.sin(angle) * radial * 0.68;
      const prevAngle = angle - 0.08;
      const prevR = radial + eventR * 0.08;
      const px = Math.cos(prevAngle) * prevR;
      const py = Math.sin(prevAngle) * prevR * 0.68;
      const color = ACCRETION_COLORS[i % ACCRETION_COLORS.length];
      const alpha = Math.min(1, cycle * 3) * (1 - cycle * 0.35);

      this.matter.moveTo(px, py);
      this.matter.lineTo(x, y);
      this.matter.stroke({
        width: seed.size,
        color,
        alpha: alpha * 0.7 * intensity,
        cap: "round",
      });
      this.matter.circle(x, y, seed.size * 0.7);
      this.matter.fill({ color, alpha: alpha * intensity });
    }
  }
}

/** Draw a rotated elliptical arc with line segments. */
function drawEllipseArc(
  g: Graphics,
  radius: number,
  squash: number,
  start: number,
  span: number,
  rotation: number,
  width: number,
  color: number,
  alpha: number,
): void {
  const steps = 5;
  for (let i = 0; i <= steps; i++) {
    const angle = start + (span * i) / steps;
    const ex = Math.cos(angle) * radius;
    const ey = Math.sin(angle) * radius * squash;
    const x = ex * Math.cos(rotation) - ey * Math.sin(rotation);
    const y = ex * Math.sin(rotation) + ey * Math.cos(rotation);
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke({ width, color, alpha, cap: "round" });
}
