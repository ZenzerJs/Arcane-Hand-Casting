/**
 * Stage 5 arena glue: Pixi + Matter + keyboard cast + Ember hand machine.
 * React mounts host; pushes vision samples; samples HUD sparsely.
 */

import { arenaConfig } from "@/game/config/arena";
import type { ArenaStats } from "@/game/entities/types";
import { KeyboardAim } from "@/game/input/KeyboardAim";
import { canCast, cooldownRemainingMs } from "@/game/logic/castCooldown";
import { ArenaWorld } from "@/game/physics/ArenaWorld";
import { ArenaRenderer } from "@/game/render/ArenaRenderer";
import { EmberOrbMachine } from "@/game/spells/emberOrb";
import { GameLoop } from "@/game/GameLoop";
import type { HandFeatures } from "@/vision/features";
import type { TrackingQuality } from "@/vision/quality";

export type StatsListener = (stats: ArenaStats) => void;

type VisionSample = {
  features: HandFeatures;
  quality: TrackingQuality;
};

export class GameController {
  private world: ArenaWorld | null = null;
  private renderer: ArenaRenderer | null = null;
  private loop: GameLoop | null = null;
  private input: KeyboardAim | null = null;
  private ember = new EmberOrbMachine();
  private lastKeyboardCastMs = -Infinity;
  private visionSample: VisionSample | null = null;
  private statsListener: StatsListener | null = null;
  private lastEmberState: ArenaStats["emberState"] = "IDLE";
  private lastEmberCharge = 0;
  private lastEmberCooldownMs = 0;

  onStats(listener: StatsListener): void {
    this.statsListener = listener;
  }

  /**
   * Latest vision features from React camera loop.
   * Safe to call at ~25 Hz; engine reads newest sample each tick.
   */
  setVisionSample(features: HandFeatures, quality: TrackingQuality): void {
    this.visionSample = { features, quality };
  }

  clearVisionSample(): void {
    this.visionSample = null;
  }

  async mount(host: HTMLElement): Promise<void> {
    this.destroy();

    this.world = new ArenaWorld();
    this.renderer = await ArenaRenderer.create(host);
    this.input = new KeyboardAim();
    this.input.attach();
    this.ember = new EmberOrbMachine();
    this.loop = new GameLoop((deltaMs) => this.update(deltaMs));
    this.loop.start();
    this.emitStats(performance.now());
  }

  update(deltaMs: number): void {
    if (!this.world || !this.renderer || !this.input) return;

    const now = performance.now();
    const { cast: keyboardCast } = this.input.update(
      deltaMs,
      arenaConfig.aimTurnSpeed,
    );

    let aimRadians = this.input.aimRadians;

    if (this.visionSample) {
      const snapshot = this.ember.update({
        features: this.visionSample.features,
        quality: this.visionSample.quality,
        nowMs: now,
        fallbackAimRadians: this.input.aimRadians,
      });
      aimRadians = snapshot.aimRadians;
      this.lastEmberCharge = snapshot.charge;
      this.lastEmberState = snapshot.state;
      this.lastEmberCooldownMs = snapshot.cooldownRemainingMs;

      if (snapshot.castEvent) {
        this.world.castOrb(snapshot.castEvent.aimRadians, now, {
          radius: snapshot.castEvent.radius,
          speedScale: snapshot.castEvent.power,
        });
      }
    } else {
      this.lastEmberState = "IDLE";
      this.lastEmberCharge = 0;
      this.lastEmberCooldownMs = 0;
    }

    if (
      keyboardCast &&
      canCast(now, this.lastKeyboardCastMs, arenaConfig.castCooldownMs)
    ) {
      this.world.castOrb(this.input.aimRadians, now);
      this.lastKeyboardCastMs = now;
      aimRadians = this.input.aimRadians;
    }

    this.world.step(deltaMs);
    this.renderer.draw(
      this.world.listBodies(),
      aimRadians,
      arenaConfig.playerX,
      arenaConfig.playerY,
      {
        charge: this.visionSample ? this.lastEmberCharge : 0,
        emberState: this.visionSample ? this.lastEmberState : "IDLE",
      },
    );
    this.emitStats(now, aimRadians);
  }

  destroy(): void {
    this.loop?.stop();
    this.loop = null;
    this.input?.detach();
    this.input = null;
    this.renderer?.destroy();
    this.renderer = null;
    this.world?.destroy();
    this.world = null;
    this.visionSample = null;
    this.lastKeyboardCastMs = -Infinity;
    this.ember.reset();
    this.lastEmberState = "IDLE";
    this.lastEmberCharge = 0;
    this.lastEmberCooldownMs = 0;
  }

  private emitStats(nowMs: number, aimRadians = 0): void {
    if (!this.world || !this.input || !this.statsListener) return;
    const board = this.world.getScoreboard();
    const keyboardCd = cooldownRemainingMs(
      nowMs,
      this.lastKeyboardCastMs,
      arenaConfig.castCooldownMs,
    );

    this.statsListener({
      ...board,
      aimRadians,
      cooldownRemainingMs: Math.max(keyboardCd, this.lastEmberCooldownMs),
      emberState: this.lastEmberState,
      emberCharge: this.lastEmberCharge,
    });
  }
}
