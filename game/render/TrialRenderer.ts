/**
 * Transparent PixiJS layer for Stage 8 trial mode.
 *
 * Draws drifting rune wisps, diving hazard bolts, the player ward-line, and
 * short particle bursts fed by TrialEvents (kill / block / life lost).
 *
 * Coordinates arrive camera-normalized (0..1); renderer mirrors x for selfie.
 */

import {
  Application,
  BlurFilter,
  Container,
  Graphics,
} from "pixi.js";
import type { Hazard, TrialEvent, Wisp } from "@/game/trial/trial";
import type { Vec2 } from "@/vision/types";

export type TrialRenderFrame = {
  wisps: readonly Wisp[];
  hazards: readonly Hazard[];
  running: boolean;
};

type Burst = {
  pos: Vec2; // screen px
  bornMs: number;
  color: number;
  size: number;
};

const WISP_COLOR = 0xb9a7ff;
const WISP_CORE = 0xf3edff;
const HAZARD_COLOR = 0xff5c49;
const HAZARD_TAIL = 0xffa15c;
const BLOCK_COLOR = 0x3de0d0;
const BURST_LIFE_MS = 420;

export class TrialRenderer {
  private readonly app: Application;
  private readonly group = new Container();
  private readonly glow = new Graphics();
  private readonly bodies = new Graphics();
  private readonly fx = new Graphics();

  private frame: TrialRenderFrame = { wisps: [], hazards: [], running: false };
  private bursts: Burst[] = [];
  private rafId = 0;
  private destroyed = false;

  private constructor(app: Application) {
    this.app = app;
    for (const g of [this.glow, this.bodies, this.fx]) {
      g.blendMode = "add";
    }
    this.glow.filters = [new BlurFilter({ strength: 8, quality: 2 })];
    this.group.addChild(this.glow, this.bodies, this.fx);
    this.app.stage.addChild(this.group);
    this.group.visible = false;

    this.animate = this.animate.bind(this);
    this.rafId = requestAnimationFrame(this.animate);
  }

  static async create(host: HTMLElement): Promise<TrialRenderer> {
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
    return new TrialRenderer(app);
  }

  update(frame: TrialRenderFrame): void {
    this.frame = frame;
  }

  /** Feed step events so kills/blocks flash where they happened. */
  pushEvents(events: readonly TrialEvent[]): void {
    const now = performance.now();
    for (const event of events) {
      if (event.kind === "wispKilled") {
        this.bursts.push({
          pos: this.toScreen(event.pos),
          bornMs: now,
          color: event.by === "void" ? 0x8b6cff : WISP_COLOR,
          size: 26,
        });
      } else if (event.kind === "hazardBlocked") {
        this.bursts.push({
          pos: this.toScreen(event.pos),
          bornMs: now,
          color: BLOCK_COLOR,
          size: 34,
        });
      } else if (event.kind === "lifeLost") {
        this.bursts.push({
          pos: this.toScreen(event.pos),
          bornMs: now,
          color: HAZARD_COLOR,
          size: 44,
        });
      }
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.app.destroy(true, { children: true });
  }

  private toScreen(p: Vec2): Vec2 {
    return {
      x: (1 - p.x) * this.app.screen.width,
      y: p.y * this.app.screen.height,
    };
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

  private renderFrame(t: number): void {
    this.glow.clear();
    this.bodies.clear();
    this.fx.clear();

    const { wisps, hazards, running } = this.frame;
    const hasContent =
      running || wisps.length > 0 || hazards.length > 0 || this.bursts.length > 0;
    this.group.visible = hasContent;
    if (!hasContent) return;

    const w = this.app.screen.width;
    const h = this.app.screen.height;
    const scale = Math.min(w, h);

    for (const wisp of wisps) {
      const p = this.toScreen(wisp.pos);
      const r = wisp.radius * scale;
      const pulse = 1 + Math.sin(t * 0.004 + wisp.id * 1.7) * 0.12;

      this.glow.circle(p.x, p.y, r * 2.1 * pulse);
      this.glow.fill({ color: WISP_COLOR, alpha: 0.25 });

      this.bodies.circle(p.x, p.y, r * pulse);
      this.bodies.stroke({ width: 2, color: WISP_COLOR, alpha: 0.9 });
      this.bodies.circle(p.x, p.y, r * 0.45 * pulse);
      this.bodies.fill({ color: WISP_CORE, alpha: 0.9 });

      // Rune ticks orbiting each wisp.
      for (let i = 0; i < 3; i++) {
        const ang = t * 0.0016 + wisp.id + (i / 3) * Math.PI * 2;
        this.bodies.circle(
          p.x + Math.cos(ang) * r * 1.5,
          p.y + Math.sin(ang) * r * 1.5,
          1.6,
        );
        this.bodies.fill({ color: WISP_COLOR, alpha: 0.7 });
      }
    }

    for (const hazard of hazards) {
      const p = this.toScreen(hazard.pos);
      const r = hazard.radius * scale;
      // Tail points opposite travel; velocity x is mirrored on screen.
      const mag = Math.hypot(hazard.vel.x, hazard.vel.y) || 1;
      const tx = (hazard.vel.x / mag) * r * 4;
      const ty = (-hazard.vel.y / mag) * r * 4;

      this.glow.circle(p.x, p.y, r * 2.4);
      this.glow.fill({ color: HAZARD_COLOR, alpha: 0.4 });

      this.bodies.moveTo(p.x + tx, p.y + ty);
      this.bodies.lineTo(p.x, p.y);
      this.bodies.stroke({
        width: r * 0.9,
        color: HAZARD_TAIL,
        alpha: 0.75,
        cap: "round",
      });
      this.bodies.circle(p.x, p.y, r);
      this.bodies.fill({ color: HAZARD_COLOR, alpha: 0.95 });
    }

    // Bursts expand + fade.
    const now = performance.now();
    this.bursts = this.bursts.filter((b) => now - b.bornMs < BURST_LIFE_MS);
    for (const burst of this.bursts) {
      const age = (now - burst.bornMs) / BURST_LIFE_MS;
      const radius = burst.size * (0.35 + age * 0.9);
      this.fx.circle(burst.pos.x, burst.pos.y, radius);
      this.fx.stroke({
        width: 2.5 * (1 - age),
        color: burst.color,
        alpha: (1 - age) * 0.9,
      });
      this.fx.circle(burst.pos.x, burst.pos.y, radius * 0.4);
      this.fx.fill({ color: burst.color, alpha: (1 - age) * 0.35 });
    }
  }
}
