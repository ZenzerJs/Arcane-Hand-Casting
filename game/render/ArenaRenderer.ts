/**
 * PixiJS view of ArenaWorld bodies.
 * Stage 5: charge spark at player + radius-scaled orbs.
 */

import { Application, Container, Graphics } from "pixi.js";
import { arenaConfig } from "@/game/config/arena";
import type { EmberHudState } from "@/game/entities/types";
import type { ArenaBody } from "@/game/physics/ArenaWorld";

const COLORS: Record<string, number> = {
  orb: 0xff7a3a,
  target: 0x8b6cff,
  player: 0x3de0d0,
  wall: 0x1a2438,
};

export type RenderFx = {
  charge: number;
  emberState: EmberHudState;
};

export class ArenaRenderer {
  readonly app: Application;
  private readonly layer = new Container();
  private readonly fxGfx = new Graphics();

  private constructor(app: Application) {
    this.app = app;
    this.app.stage.addChild(this.layer);
    this.app.stage.addChild(this.fxGfx);
  }

  static async create(host: HTMLElement): Promise<ArenaRenderer> {
    const app = new Application();
    await app.init({
      width: arenaConfig.width,
      height: arenaConfig.height,
      background: "#070b14",
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.replaceChildren(app.canvas);
    app.canvas.style.width = "100%";
    app.canvas.style.height = "auto";
    app.canvas.style.display = "block";
    app.canvas.style.borderRadius = "0.5rem";
    return new ArenaRenderer(app);
  }

  draw(
    bodies: ArenaBody[],
    aimRadians: number,
    playerX: number,
    playerY: number,
    fx: RenderFx = { charge: 0, emberState: "IDLE" },
  ): void {
    this.layer.removeChildren().forEach((child) => child.destroy());

    for (const body of bodies) {
      const kind = body.plugin?.kind;
      if (!kind || kind === "wall") continue;

      const g = new Graphics();
      const color = COLORS[kind] ?? 0xffffff;
      const radius =
        kind === "orb"
          ? (body.plugin.radius ?? arenaConfig.orbRadius)
          : kind === "target"
            ? arenaConfig.targetRadius
            : 18;

      g.circle(0, 0, radius);
      g.fill({ color, alpha: kind === "player" ? 0.85 : 0.95 });
      if (kind === "target") {
        g.circle(0, 0, radius * 0.45);
        g.stroke({ color: 0xe8eefc, width: 2, alpha: 0.7 });
      }
      if (kind === "orb") {
        g.circle(0, 0, radius * 0.35);
        g.fill({ color: 0xffd1a8, alpha: 0.8 });
      }
      g.x = body.position.x;
      g.y = body.position.y;
      this.layer.addChild(g);
    }

    this.fxGfx.clear();

    // Aim guide — longer / brighter while charging.
    const charging =
      fx.emberState === "PREPARING" || fx.emberState === "CHARGING";
    const len = 70 + fx.charge * 50;
    this.fxGfx.moveTo(playerX, playerY);
    this.fxGfx.lineTo(
      playerX + Math.cos(aimRadians) * len,
      playerY + Math.sin(aimRadians) * len,
    );
    this.fxGfx.stroke({
      color: 0xff7a3a,
      width: charging ? 3 + fx.charge * 3 : 3,
      alpha: charging ? 0.75 + fx.charge * 0.25 : 0.9,
    });

    // Charge spark around caster.
    if (charging || fx.emberState === "CAST") {
      const sparkR = 10 + fx.charge * 28;
      this.fxGfx.circle(playerX, playerY, sparkR);
      this.fxGfx.stroke({
        color: 0xff7a3a,
        width: 2,
        alpha: 0.35 + fx.charge * 0.5,
      });
      this.fxGfx.circle(playerX, playerY, sparkR * 0.45);
      this.fxGfx.fill({ color: 0xff7a3a, alpha: 0.2 + fx.charge * 0.35 });
    }
  }

  destroy(): void {
    this.app.destroy(true, { children: true });
  }
}
