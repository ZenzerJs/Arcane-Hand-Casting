/**
 * Transparent PixiJS lightning arcs over the mirrored webcam.
 *
 * Exactly five bolts (one per finger). Each finger fires once per second;
 * that bolt holds for one second (stable jagged path), then fires again.
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
import type { Vec2 } from "@/vision/types";

export type LightningBolt = readonly [Vec2, Vec2];

export type LightningFrame = {
  /** Up to five finger jets. Empty = no lightning. */
  bolts: readonly LightningBolt[];
};

const CORE_COLOR = 0xeaf2ff;
const GLOW_COLOR = 0x6a5bff;
const BRANCH_COLOR = 0xaab6ff;
const MAX_BOLTS = 5;
const MIN_SPAN_PX = 36;

type FingerStrike = {
  /** When this bolt fired. */
  firedAt: number;
  /** PRNG seed frozen for the bolt lifetime so the jag stays stable. */
  seed: number;
};

export class LightningRenderer {
  private readonly app: Application;
  private readonly group = new Container();
  private readonly glow = new Graphics();
  private readonly branches = new Graphics();
  private readonly core = new Graphics();

  private frame: LightningFrame = { bolts: [] };
  private strikes: Array<FingerStrike | null> = [
    null,
    null,
    null,
    null,
    null,
  ];
  private seed = 1;
  private rafId = 0;
  private destroyed = false;

  private constructor(app: Application) {
    this.app = app;

    for (const g of [this.glow, this.branches, this.core]) {
      g.blendMode = "add";
    }
    this.glow.filters = [new BlurFilter({ strength: 10, quality: 3 })];
    this.branches.filters = [new BlurFilter({ strength: 2, quality: 2 })];

    this.group.addChild(this.glow, this.branches, this.core);
    this.app.stage.addChild(this.group);

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

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.app.destroy(true, { children: true });
  }

  private random(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  private toScreen(p: Vec2): Vec2 {
    return {
      x: (1 - p.x) * this.app.screen.width,
      y: p.y * this.app.screen.height,
    };
  }

  private animate(timestamp: number): void {
    if (this.destroyed) return;

    const bolts = this.frame.bolts.slice(0, MAX_BOLTS);
    const period = lightningConfig.firePeriodMs;
    const life = lightningConfig.boltLifetimeMs;

    this.glow.clear();
    this.branches.clear();
    this.core.clear();

    if (bolts.length === 0) {
      this.strikes = [null, null, null, null, null];
      this.group.visible = false;
      this.rafId = requestAnimationFrame(this.animate);
      return;
    }

    this.group.visible = true;
    let anyAlive = false;

    for (let i = 0; i < bolts.length; i++) {
      let strike = this.strikes[i];
      // Fire (or refire) once per second per finger.
      if (!strike || timestamp - strike.firedAt >= period) {
        strike = {
          firedAt: timestamp,
          seed: ((i + 1) * 2654435761) ^ Math.floor(timestamp),
        };
        this.strikes[i] = strike;
      }

      const age = timestamp - strike.firedAt;
      if (age >= life) continue;
      anyAlive = true;

      // Hold full brightness most of the second; soft fade at the end.
      const fade = age > life - 150 ? (life - age) / 150 : 1;

      this.seed = strike.seed;
      const a0 = this.toScreen(bolts[i][0]);
      let b0 = this.toScreen(bolts[i][1]);
      const span = Math.hypot(b0.x - a0.x, b0.y - a0.y);
      if (span < MIN_SPAN_PX) {
        const dx = b0.x - a0.x;
        const dy = b0.y - a0.y;
        const mag = Math.hypot(dx, dy) || 1;
        b0 = {
          x: a0.x + (dx / mag) * MIN_SPAN_PX,
          y: a0.y + (dy / mag) * MIN_SPAN_PX,
        };
      }
      this.drawArc(a0.x, a0.y, b0.x, b0.y, fade);
    }

    if (!anyAlive) this.group.visible = false;
    this.rafId = requestAnimationFrame(this.animate);
  }

  private drawArc(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    alphaScale: number,
  ): void {
    const a: Vec2 = { x: ax, y: ay };
    const b: Vec2 = { x: bx, y: by };
    const span = Math.hypot(bx - ax, by - ay);
    const jag = Math.min(Math.max(span * 0.1, 8), 36);
    const points = this.buildPath(a, b, jag, 4);
    const coreWidth = 2.4;

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

    if (points.length > 3) {
      const nodeIndex = 1 + Math.floor(this.random() * (points.length - 2));
      const origin = points[nodeIndex];
      const dirAngle =
        Math.atan2(by - ay, bx - ax) + (this.random() - 0.5) * 1.0;
      const length = span * 0.18;
      const tip: Vec2 = {
        x: origin.x + Math.cos(dirAngle) * length,
        y: origin.y + Math.sin(dirAngle) * length,
      };
      const branchPts = this.buildPath(origin, tip, jag * 0.4, 2);
      this.strokePath(
        this.branches,
        branchPts,
        coreWidth * 0.55,
        BRANCH_COLOR,
        0.55 * alphaScale,
      );
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
