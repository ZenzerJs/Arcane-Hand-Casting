/**
 * Transparent PixiJS lightning arcs over the mirrored webcam.
 *
 * Five finger slots. Each arc grows tip→tip once when its finger connects,
 * then stays CONTINUOUSLY lit — life comes from slow brightness shimmer and
 * periodic path reshapes, never from blackout gaps (blackouts read as strobe).
 * Unreadable fingers arrive as short `flicker` sparks (no tip↔tip bridge).
 *
 * Coordinates arrive camera-normalized (0..1); renderer mirrors x for selfie.
 */

import {
  Application,
  BlurFilter,
  Container,
  Graphics,
} from "pixi.js";
import { lightningConfig } from "@/game/config/spells";
import type { BoltSegment } from "@/game/spells/pointerBeams";
import type { Vec2 } from "@/vision/types";
import { coverViewport } from "@/vision/viewport";

export type LightningBolt = BoltSegment;

export type LightningFrame = {
  /** Up to five finger jets. Empty = no lightning. */
  bolts: readonly LightningBolt[];
};

const CORE_COLOR = 0xeaf2ff;
const GLOW_COLOR = 0x6a5bff;
const BRANCH_COLOR = 0xaab6ff;
const MAX_BOLTS = 5;
const MIN_SPAN_PX = 28;
const FLICKER_MIN_SPAN_PX = 12;

export class LightningRenderer {
  private readonly app: Application;
  private readonly group = new Container();
  private readonly glow = new Graphics();
  private readonly branches = new Graphics();
  private readonly core = new Graphics();
  private readonly glowBlur = new BlurFilter({ strength: 10, quality: 3 });
  private readonly branchBlur = new BlurFilter({ strength: 2, quality: 2 });

  private frame: LightningFrame = { bolts: [] };
  /** When each finger slot connected; null while that finger is dark. */
  private slotConnectedAt: Array<number | null> = [
    null,
    null,
    null,
    null,
    null,
  ];
  private seed = 1;
  private rafId = 0;
  private destroyed = false;
  private videoW = 0;
  private videoH = 0;

  private constructor(app: Application) {
    this.app = app;

    for (const g of [this.glow, this.branches, this.core]) {
      g.blendMode = "add";
    }
    this.glow.filters = [this.glowBlur];
    this.branches.filters = [this.branchBlur];

    this.group.addChild(this.glow, this.branches, this.core);
    this.app.stage.addChild(this.group);
    this.group.visible = false;

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  static async create(host: HTMLElement): Promise<LightningRenderer> {
    const app = new Application();
    await app.init({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      // Prefer wiping the buffer each paint so additive strokes never ghost.
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

    return new LightningRenderer(app);
  }

  update(frame: LightningFrame): void {
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
    this.clearDraw();
    this.app.destroy(true, { children: true });
  }

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  private toScreen(p: Vec2): Vec2 {
    return coverViewport(
      this.videoW,
      this.videoH,
      this.app.screen.width,
      this.app.screen.height,
    ).toScreenMirrored(p);
  }

  private clearDraw(): void {
    this.glow.clear();
    this.branches.clear();
    this.core.clear();
  }

  private animate(timestamp: number): void {
    if (this.destroyed) return;
    // One bad frame must never kill the RAF chain — a dead loop leaves the
    // last strike frozen on the canvas (the "static ghost bolt" bug).
    try {
      this.renderFrame(timestamp);
    } catch {
      this.clearDraw();
      this.group.visible = false;
    }
    this.rafId = requestAnimationFrame(this.animate);
  }

  private renderFrame(timestamp: number): void {
    const bolts = this.frame.bolts
      .slice(0, MAX_BOLTS)
      .filter(isBoltShape);
    const travel = lightningConfig.travelMs;

    this.clearDraw();

    if (bolts.length === 0) {
      this.slotConnectedAt.fill(null);
      this.group.visible = false;
      return;
    }

    this.group.visible = true;
    let anyAlive = false;

    // Bucket by finger so missing slots do not shift other fingers.
    const byFinger: Array<LightningBolt | null> = [
      null,
      null,
      null,
      null,
      null,
    ];
    for (const bolt of bolts) {
      const slot = Math.max(0, Math.min(MAX_BOLTS - 1, bolt.finger));
      byFinger[slot] = bolt;
    }

    for (let slot = 0; slot < MAX_BOLTS; slot++) {
      const bolt = byFinger[slot];
      if (!bolt) {
        this.slotConnectedAt[slot] = null;
        continue;
      }

      // Grow tip→tip once when the finger connects, then stay lit.
      if (this.slotConnectedAt[slot] === null) {
        // Small per-finger stagger on connect so five arcs cascade in.
        this.slotConnectedAt[slot] = timestamp + slot * 45;
      }
      const elapsed = timestamp - (this.slotConnectedAt[slot] as number);
      if (elapsed < 0) continue;
      anyAlive = true;

      // Reshape the jagged path on a slow clock, offset per finger so all
      // five arcs never snap to a new shape on the same frame.
      const pathFrame = Math.floor(
        (timestamp + slot * 31) / lightningConfig.pathRefreshMs,
      );
      this.seed =
        ((slot + 1) * 2654435761) ^
        (pathFrame * 2246822519) ^
        ((pathFrame + slot * 17) * 3266489917);

      // Continuous brightness shimmer instead of blackout gaps — this is
      // what killed the strobing. Two slow sines, per-finger phase.
      const t = timestamp * 0.001;
      const wave =
        0.5 +
        0.5 * Math.sin(t * 5.3 + slot * 2.1) * Math.sin(t * 3.1 + slot * 0.7);
      const shimmer =
        lightningConfig.shimmerFloor +
        (1 - lightningConfig.shimmerFloor) * wave;

      const progress =
        bolt.kind === "flicker"
          ? 1
          : Math.min(1, elapsed / Math.max(1, travel));

      const a0 = this.toScreen(bolt.from);
      let b0 = this.toScreen(bolt.to);
      const minSpan =
        bolt.kind === "flicker" ? FLICKER_MIN_SPAN_PX : MIN_SPAN_PX;
      const span = Math.hypot(b0.x - a0.x, b0.y - a0.y);
      if (span < minSpan) {
        const dx = b0.x - a0.x;
        const dy = b0.y - a0.y;
        const mag = Math.hypot(dx, dy) || 1;
        b0 = {
          x: a0.x + (dx / mag) * minSpan,
          y: a0.y + (dy / mag) * minSpan,
        };
      }

      const alpha = bolt.kind === "flicker" ? shimmer * 0.5 : shimmer;
      this.drawArc(a0.x, a0.y, b0.x, b0.y, alpha, progress, bolt.kind);
    }

    if (!anyAlive) this.group.visible = false;
  }

  private drawArc(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    alphaScale: number,
    progress: number,
    kind: "arc" | "flicker",
  ): void {
    const a: Vec2 = { x: ax, y: ay };
    const b: Vec2 = { x: bx, y: by };
    const span = Math.hypot(bx - ax, by - ay);
    const jag =
      kind === "flicker"
        ? Math.min(Math.max(span * 0.22, 4), 14)
        : Math.min(Math.max(span * 0.12, 10), 42);
    const depth = kind === "flicker" ? 2 : 4;
    const full = this.buildPath(a, b, jag, depth);
    const points = clipPath(full, progress);
    if (points.length < 2) return;

    const coreWidth = kind === "flicker" ? 1.6 : 2.6;
    const tip = points[points.length - 1];

    this.strokePath(
      this.glow,
      points,
      coreWidth * 3.2,
      GLOW_COLOR,
      0.4 * alphaScale,
    );
    this.strokePath(
      this.core,
      points,
      coreWidth * 1.8,
      GLOW_COLOR,
      0.5 * alphaScale,
    );
    this.strokePath(
      this.core,
      points,
      coreWidth,
      CORE_COLOR,
      0.95 * alphaScale,
    );

    if (kind === "arc" && progress > 0.5 && full.length > 3) {
      const nodeIndex = 1 + Math.floor(this.random() * (full.length - 2));
      const origin = full[nodeIndex];
      const revealed = clipPath(full, progress);
      const near = revealed.some(
        (p) => Math.hypot(p.x - origin.x, p.y - origin.y) < 8,
      );
      if (near) {
        const dirAngle =
          Math.atan2(tip.y - ay, tip.x - ax) + (this.random() - 0.5) * 1.1;
        const length = span * 0.2 * progress;
        const branchTip: Vec2 = {
          x: origin.x + Math.cos(dirAngle) * length,
          y: origin.y + Math.sin(dirAngle) * length,
        };
        const branchPts = this.buildPath(origin, branchTip, jag * 0.4, 2);
        this.strokePath(
          this.branches,
          branchPts,
          coreWidth * 0.55,
          BRANCH_COLOR,
          0.55 * alphaScale,
        );
      }
    }
  }

  private buildPath(a: Vec2, b: Vec2, jag: number, depth: number): Vec2[] {
    let points: Vec2[] = [a, b];
    let amplitude = jag;
    for (let d = 0; d < depth; d++) {
      const next: Vec2[] = [];
      for (let i = 0; i < points.length - 1; i++) {
        const p = points[i];
        const q = points[i + 1];
        next.push(p);
        const mx = (p.x + q.x) / 2;
        const my = (p.y + q.y) / 2;
        const dx = q.x - p.x;
        const dy = q.y - p.y;
        const len = Math.hypot(dx, dy) || 1;
        const nx = -dy / len;
        const ny = dx / len;
        const offset = (this.random() - 0.5) * 2 * amplitude;
        next.push({ x: mx + nx * offset, y: my + ny * offset });
      }
      next.push(points[points.length - 1]);
      points = next;
      amplitude *= 0.55;
    }
    return points;
  }

  private strokePath(
    g: Graphics,
    points: Vec2[],
    width: number,
    color: number,
    alpha: number,
  ): void {
    g.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      g.lineTo(points[i].x, points[i].y);
    }
    g.stroke({ width, color, alpha, cap: "round", join: "round" });
  }
}

/** Guard against stale-module frames (HMR can deliver old tuple shapes). */
function isBoltShape(b: unknown): b is BoltSegment {
  if (typeof b !== "object" || b === null) return false;
  const bolt = b as Partial<BoltSegment>;
  return (
    typeof bolt.from?.x === "number" &&
    typeof bolt.from?.y === "number" &&
    typeof bolt.to?.x === "number" &&
    typeof bolt.to?.y === "number" &&
    typeof bolt.finger === "number"
  );
}

/** Keep the leading fraction of a polyline (by segment length). */
function clipPath(points: Vec2[], progress: number): Vec2[] {
  if (points.length < 2 || progress >= 1) return points;
  if (progress <= 0) return [points[0]];

  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    total += Math.hypot(
      points[i + 1].x - points[i].x,
      points[i + 1].y - points[i].y,
    );
  }
  if (total < 1e-6) return [points[0]];

  const target = total * progress;
  let walked = 0;
  const out: Vec2[] = [points[0]];
  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const seg = Math.hypot(q.x - p.x, q.y - p.y);
    if (walked + seg >= target) {
      const t = (target - walked) / (seg || 1);
      out.push({
        x: p.x + (q.x - p.x) * t,
        y: p.y + (q.y - p.y) * t,
      });
      return out;
    }
    out.push(q);
    walked += seg;
  }
  return out;
}
