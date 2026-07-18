/**
 * Matter.js simulation for the Stage 4 keyboard arena.
 * Owns walls, player marker, orbs, and destructible targets.
 */

import Matter from "matter-js";
import { arenaConfig } from "@/game/config/arena";
import type { CastOrbOptions, EntityKind } from "@/game/entities/types";

export type ArenaBody = Matter.Body & {
  plugin: {
    kind: EntityKind;
    bornAtMs?: number;
    /** Drawn radius for orbs (charge-scaled). */
    radius?: number;
  };
};

function tag(
  body: Matter.Body,
  kind: EntityKind,
  bornAtMs?: number,
  radius?: number,
): ArenaBody {
  body.plugin = { kind, bornAtMs, radius };
  return body as ArenaBody;
}

export class ArenaWorld {
  readonly engine: Matter.Engine;
  readonly world: Matter.World;
  private score = 0;
  private casts = 0;
  private hits = 0;
  private nextTargetId = 1;

  constructor() {
    this.engine = Matter.Engine.create({
      gravity: { x: 0, y: arenaConfig.gravityY },
    });
    this.world = this.engine.world;
    this.buildWalls();
    this.spawnPlayerMarker();
    this.spawnTargetWave();

    Matter.Events.on(this.engine, "collisionStart", (event) => {
      for (const pair of event.pairs) {
        this.handleCollision(pair.bodyA as ArenaBody, pair.bodyB as ArenaBody);
      }
    });
  }

  getScoreboard() {
    return {
      score: this.score,
      casts: this.casts,
      hits: this.hits,
      targetsLeft: this.listByKind("target").length,
    };
  }

  step(deltaMs: number): void {
    // Matter expects seconds; clamp huge frame spikes after tab sleep.
    const dt = Math.min(deltaMs, 32) / 1000;
    Matter.Engine.update(this.engine, dt * 1000);

    const now = performance.now();
    for (const orb of this.listByKind("orb")) {
      const born = orb.plugin.bornAtMs ?? now;
      if (now - born > arenaConfig.orbLifetimeMs) {
        Matter.World.remove(this.world, orb);
      }
    }

    if (this.listByKind("target").length === 0) {
      this.spawnTargetWave();
    }
  }

  /**
   * Spawn an Ember-like orb at the player with velocity along aimRadians.
   * Screen space: 0 rad = right, positive = clockwise (y grows down).
   */
  castOrb(aimRadians: number, nowMs: number, options: CastOrbOptions = {}): void {
    this.casts += 1;
    const { playerX, playerY, orbRadius, orbSpeed } = arenaConfig;
    const radius = options.radius ?? orbRadius;
    const speedScale = options.speedScale ?? 1;
    const orb = tag(
      Matter.Bodies.circle(playerX, playerY, radius, {
        label: `orb-${this.casts}`,
        frictionAir: 0.002,
        restitution: 0.2,
        density: 0.002,
      }),
      "orb",
      nowMs,
      radius,
    );
    const speed = (orbSpeed * speedScale) / 60;
    Matter.Body.setVelocity(orb, {
      x: Math.cos(aimRadians) * speed,
      y: Math.sin(aimRadians) * speed,
    });
    Matter.World.add(this.world, orb);
  }

  listBodies(): ArenaBody[] {
    return this.world.bodies as ArenaBody[];
  }

  destroy(): void {
    Matter.World.clear(this.world, false);
    Matter.Engine.clear(this.engine);
  }

  private listByKind(kind: EntityKind): ArenaBody[] {
    return this.listBodies().filter((body) => body.plugin?.kind === kind);
  }

  private handleCollision(a: ArenaBody, b: ArenaBody): void {
    const kinds = new Set([a.plugin?.kind, b.plugin?.kind]);
    if (!kinds.has("orb") || !kinds.has("target")) return;

    const orb = a.plugin.kind === "orb" ? a : b;
    const target = a.plugin.kind === "target" ? a : b;
    Matter.World.remove(this.world, orb);
    Matter.World.remove(this.world, target);
    this.hits += 1;
    this.score += 100;
  }

  private buildWalls(): void {
    const { width, height, wallThickness: t } = arenaConfig;
    const opts = { isStatic: true, label: "wall" };
    const walls = [
      tag(Matter.Bodies.rectangle(width / 2, -t / 2, width, t, opts), "wall"),
      tag(Matter.Bodies.rectangle(width / 2, height + t / 2, width, t, opts), "wall"),
      tag(Matter.Bodies.rectangle(-t / 2, height / 2, t, height, opts), "wall"),
      tag(Matter.Bodies.rectangle(width + t / 2, height / 2, t, height, opts), "wall"),
    ];
    Matter.World.add(this.world, walls);
  }

  private spawnPlayerMarker(): void {
    const body = tag(
      Matter.Bodies.circle(arenaConfig.playerX, arenaConfig.playerY, 18, {
        isStatic: true,
        isSensor: true,
        label: "player",
      }),
      "player",
    );
    Matter.World.add(this.world, body);
  }

  private spawnTargetWave(): void {
    const { width, height, targetRadius, targetCount } = arenaConfig;
    const bodies: Matter.Body[] = [];
    for (let i = 0; i < targetCount; i++) {
      const x = width * 0.45 + (i % 3) * 140;
      const y = height * 0.22 + Math.floor(i / 3) * 140;
      const id = this.nextTargetId++;
      bodies.push(
        tag(
          Matter.Bodies.circle(x, y, targetRadius, {
            isStatic: true,
            label: `target-${id}`,
            restitution: 0.1,
          }),
          "target",
        ),
      );
    }
    Matter.World.add(this.world, bodies);
  }
}
