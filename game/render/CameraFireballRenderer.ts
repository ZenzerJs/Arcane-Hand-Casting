/**
 * Transparent PixiJS fireball rendered over the mirrored webcam.
 *
 * The flame is built from soft radial-gradient TEXTURES (drawn once on a
 * 2D canvas) instead of hard-edged vector circles. Feathered alpha edges +
 * additive blending read as real volumetric fire, and sprites scale to any
 * size with no aliasing — so the orb can grow without an upper bound.
 *
 * Layers (back -> front):
 *   1. Wide blurred heat halo
 *   2. Turbulent additive corona tongues
 *   3. Flame body + drifting lobes
 *   4. White-hot core
 *   5. Rising sparks + smoke particles
 *
 * No external image asset needed; textures are generated procedurally.
 */

import {
  Application,
  BlurFilter,
  Container,
  Sprite,
  Texture,
} from "pixi.js";
import type { Vec2 } from "@/vision/types";

export type CameraFireballFrame = {
  /** Two raw camera-space palm centers. Renderer mirrors x for selfie view. */
  palms: readonly [Vec2, Vec2] | null;
};

type EmberParticle = {
  sprite: Sprite;
  kind: "spark" | "smoke";
  x: number;
  y: number;
  vx: number;
  vy: number;
  baseSize: number;
  lifeMs: number;
  maxLifeMs: number;
};

type Tongue = {
  sprite: Sprite;
  phase: number;
  speed: number;
  band: number;
};

const CORONA_TONGUES = 14;
const FLAME_LOBES = 7;

/** Build a soft round texture from a radial gradient on a 2D canvas. */
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
  for (const [offset, color] of stops) {
    gradient.addColorStop(offset, color);
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  return Texture.from(canvas);
}

export class CameraFireballRenderer {
  private readonly app: Application;

  // Shared soft-round textures.
  private readonly haloTexture: Texture;
  private readonly flameTexture: Texture;
  private readonly coreTexture: Texture;
  private readonly sparkTexture: Texture;
  private readonly smokeTexture: Texture;

  private readonly fireball = new Container();
  private readonly glow = new Sprite();
  private readonly corona = new Container();
  private readonly flame = new Container();
  private readonly core = new Sprite();
  private readonly coreHot = new Sprite();
  private readonly smoke = new Container();
  private readonly particles = new Container();

  private readonly tongues: Tongue[] = [];
  private readonly lobes: Sprite[] = [];
  private readonly particlePool: EmberParticle[] = [];

  private frame: CameraFireballFrame = { palms: null };
  private smoothX = 0;
  private smoothY = 0;
  private smoothIntensity = 0;
  private smoothRadius = 20;
  private hasPosition = false;
  private lastTimestamp = performance.now();
  private spawnAccumulator = 0;
  private smokeAccumulator = 0;
  private rafId = 0;
  private destroyed = false;

  private constructor(app: Application) {
    this.app = app;

    this.haloTexture = radialTexture(256, [
      [0, "rgba(255,180,60,1)"],
      [0.35, "rgba(255,90,10,0.75)"],
      [0.7, "rgba(180,30,0,0.25)"],
      [1, "rgba(120,10,0,0)"],
    ]);
    this.flameTexture = radialTexture(256, [
      [0, "rgba(255,240,180,1)"],
      [0.28, "rgba(255,160,40,0.95)"],
      [0.6, "rgba(255,70,10,0.55)"],
      [1, "rgba(200,30,0,0)"],
    ]);
    this.coreTexture = radialTexture(256, [
      [0, "rgba(255,255,255,1)"],
      [0.35, "rgba(255,240,170,0.95)"],
      [0.7, "rgba(255,170,40,0.4)"],
      [1, "rgba(255,120,0,0)"],
    ]);
    this.sparkTexture = radialTexture(64, [
      [0, "rgba(255,240,200,1)"],
      [0.5, "rgba(255,150,40,0.9)"],
      [1, "rgba(255,80,0,0)"],
    ]);
    this.smokeTexture = radialTexture(128, [
      [0, "rgba(40,22,14,0.9)"],
      [0.6, "rgba(30,16,10,0.4)"],
      [1, "rgba(20,10,6,0)"],
    ]);

    this.glow.texture = this.haloTexture;
    this.core.texture = this.coreTexture;
    this.coreHot.texture = this.coreTexture;
    for (const s of [this.glow, this.core, this.coreHot]) {
      s.anchor.set(0.5);
      s.blendMode = "add";
    }

    // Turbulent corona tongues orbiting the body.
    for (let i = 0; i < CORONA_TONGUES; i++) {
      const sprite = new Sprite(this.flameTexture);
      sprite.anchor.set(0.5);
      sprite.blendMode = "add";
      this.corona.addChild(sprite);
      this.tongues.push({
        sprite,
        phase: i * 0.73,
        speed: 0.0012 + (i % 4) * 0.00016,
        band: i % 3,
      });
    }

    // Drifting flame lobes give the body an organic asymmetric edge.
    for (let i = 0; i < FLAME_LOBES; i++) {
      const sprite = new Sprite(this.flameTexture);
      sprite.anchor.set(0.5);
      sprite.blendMode = "add";
      this.flame.addChild(sprite);
      this.lobes.push(sprite);
    }

    this.glow.filters = [new BlurFilter({ strength: 14, quality: 3 })];
    this.smoke.filters = [new BlurFilter({ strength: 6, quality: 2 })];

    this.fireball.addChild(
      this.glow,
      this.corona,
      this.flame,
      this.core,
      this.coreHot,
    );
    this.app.stage.addChild(this.smoke, this.particles, this.fireball);

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

  /**
   * Push newest palm positions from the 25 Hz vision loop.
   * Rendering continues around 60 Hz and smooths between samples.
   */
  update(frame: CameraFireballFrame): void {
    this.frame = frame;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    for (const particle of this.particlePool) {
      particle.sprite.destroy();
    }
    this.particlePool.length = 0;
    this.app.destroy(true, { children: true });
  }

  private animate(timestamp: number): void {
    if (this.destroyed) return;
    const deltaMs = Math.min(50, timestamp - this.lastTimestamp);
    this.lastTimestamp = timestamp;

    const palms = this.frame.palms;
    const isVisible = palms !== null;

    if (palms) {
      const [leftPalm, rightPalm] = palms;
      const ax = (1 - leftPalm.x) * this.app.screen.width;
      const ay = leftPalm.y * this.app.screen.height;
      const bx = (1 - rightPalm.x) * this.app.screen.width;
      const by = rightPalm.y * this.app.screen.height;
      const targetX = (ax + bx) / 2;
      const targetY = (ay + by) / 2;

      // Diameter tracks palm gap with NO upper cap — orb keeps growing.
      const palmGapPx = Math.hypot(bx - ax, by - ay);
      const targetRadius = Math.max(14, palmGapPx * 0.26);

      // Intensity only drives particle rate / brightness, so clamp it to a
      // screen-relative reference even though radius itself is uncapped.
      const referenceRadius =
        Math.min(this.app.screen.width, this.app.screen.height) * 0.25;
      const targetIntensity = Math.min(
        1,
        targetRadius / Math.max(referenceRadius, 1),
      );

      if (!this.hasPosition) {
        this.smoothX = targetX;
        this.smoothY = targetY;
        this.smoothRadius = targetRadius;
        this.smoothIntensity = targetIntensity;
        this.hasPosition = true;
      } else {
        this.smoothX += (targetX - this.smoothX) * 0.34;
        this.smoothY += (targetY - this.smoothY) * 0.34;
        this.smoothRadius += (targetRadius - this.smoothRadius) * 0.24;
        this.smoothIntensity +=
          (targetIntensity - this.smoothIntensity) * 0.2;
      }
    }

    this.fireball.x = this.smoothX;
    this.fireball.y = this.smoothY;
    this.fireball.visible = isVisible;

    if (this.fireball.visible) {
      this.drawFireball(timestamp);
    }

    if (isVisible) {
      this.spawnAccumulator +=
        (deltaMs / 1000) * (18 + this.smoothIntensity * 42);
      while (this.spawnAccumulator >= 1) {
        this.spawnAccumulator -= 1;
        this.spawnEmber();
      }

      this.smokeAccumulator +=
        (deltaMs / 1000) * (3 + this.smoothIntensity * 5);
      while (this.smokeAccumulator >= 1) {
        this.smokeAccumulator -= 1;
        this.spawnSmoke();
      }
    }

    this.updateParticles(deltaMs);
    this.rafId = requestAnimationFrame(this.animate);
  }

  /** Size + animate each soft-sprite layer. */
  private drawFireball(timestamp: number): void {
    const radius = this.smoothRadius;
    const flickerA = 1 + Math.sin(timestamp * 0.021) * 0.05;
    const flickerB = 1 + Math.sin(timestamp * 0.037 + 1.8) * 0.04;

    // Sprite width maps 1:1 to diameter, so width = radius * 2 * factor.
    const setSize = (s: Sprite, r: number): void => {
      s.width = r * 2;
      s.height = r * 2;
    };

    setSize(this.glow, radius * 2.4 * flickerA);
    this.glow.alpha = 0.5 + this.smoothIntensity * 0.25;

    // Corona: soft tongues orbiting at varied radius/pulse.
    for (let i = 0; i < this.tongues.length; i++) {
      const t = this.tongues[i];
      const angle = timestamp * t.speed + t.phase;
      const pulse = 0.82 + Math.sin(timestamp * 0.019 + i * 1.7) * 0.16;
      const orbit = radius * (0.7 + t.band * 0.1);
      const size = radius * (0.42 + (i % 4) * 0.07) * pulse;
      t.sprite.x = Math.cos(angle) * orbit;
      t.sprite.y = Math.sin(angle) * orbit - size * 0.18;
      setSize(t.sprite, size);
      t.sprite.alpha = 0.32 + this.smoothIntensity * 0.14;
    }

    // Flame body lobes.
    for (let i = 0; i < this.lobes.length; i++) {
      const lobe = this.lobes[i];
      const angle = timestamp * (0.0007 + i * 0.00008) + i * 0.91;
      const orbit = radius * (0.14 + (i % 3) * 0.04);
      const size = radius * (1.35 + Math.sin(timestamp * 0.015 + i) * 0.12);
      lobe.x = Math.cos(angle) * orbit;
      lobe.y = Math.sin(angle) * orbit;
      setSize(lobe, size);
      lobe.alpha = 0.4;
    }

    // Cores: warm then white-hot, nudged up-left like rising heat.
    setSize(this.core, radius * 1.25 * flickerB);
    this.core.x = -radius * 0.08;
    this.core.y = -radius * 0.1;
    this.core.alpha = 0.9;

    setSize(this.coreHot, radius * 0.6 * flickerA);
    this.coreHot.x = -radius * 0.14;
    this.coreHot.y = -radius * 0.18;
    this.coreHot.alpha = 0.95;
  }

  /** Spawn one hot speck near fireball, drifting upward/outward. */
  private spawnEmber(): void {
    const angle = Math.random() * Math.PI * 2;
    const distance = this.smoothRadius * (0.35 + Math.random() * 0.75);
    const lifeMs = 320 + Math.random() * 460;
    const baseSize = 2 + Math.random() * 4;
    const sprite = new Sprite(this.sparkTexture);
    sprite.anchor.set(0.5);
    sprite.blendMode = "add";
    sprite.width = baseSize;
    sprite.height = baseSize;
    this.particles.addChild(sprite);

    this.particlePool.push({
      sprite,
      kind: "spark",
      x: this.smoothX + Math.cos(angle) * distance,
      y: this.smoothY + Math.sin(angle) * distance,
      vx: Math.cos(angle) * (12 + Math.random() * 24),
      vy: -28 - Math.random() * 55,
      baseSize,
      lifeMs,
      maxLifeMs: lifeMs,
    });
  }

  /** Soft dark smoke gives flame volume against bright camera scenes. */
  private spawnSmoke(): void {
    const angle = Math.random() * Math.PI * 2;
    const baseSize = this.smoothRadius * (0.5 + Math.random() * 0.5);
    const sprite = new Sprite(this.smokeTexture);
    sprite.anchor.set(0.5);
    sprite.width = baseSize;
    sprite.height = baseSize;
    this.smoke.addChild(sprite);

    const lifeMs = 700 + Math.random() * 650;
    this.particlePool.push({
      sprite,
      kind: "smoke",
      x: this.smoothX + Math.cos(angle) * this.smoothRadius * 0.45,
      y: this.smoothY + Math.sin(angle) * this.smoothRadius * 0.3,
      vx: Math.cos(angle) * (5 + Math.random() * 9),
      vy: -13 - Math.random() * 24,
      baseSize,
      lifeMs,
      maxLifeMs: lifeMs,
    });
  }

  private updateParticles(deltaMs: number): void {
    const seconds = deltaMs / 1000;
    for (let i = this.particlePool.length - 1; i >= 0; i--) {
      const particle = this.particlePool[i];
      particle.lifeMs -= deltaMs;
      if (particle.lifeMs <= 0) {
        particle.sprite.removeFromParent();
        particle.sprite.destroy();
        this.particlePool.splice(i, 1);
        continue;
      }

      particle.x += particle.vx * seconds;
      particle.y += particle.vy * seconds;
      particle.vy -= 12 * seconds;
      particle.sprite.x = particle.x;
      particle.sprite.y = particle.y;
      const lifeRatio = particle.lifeMs / particle.maxLifeMs;
      if (particle.kind === "smoke") {
        particle.sprite.alpha = lifeRatio * 0.22;
        const scale = 1 + (1 - lifeRatio) * 1.8;
        particle.sprite.width = particle.baseSize * scale;
        particle.sprite.height = particle.baseSize * scale;
      } else {
        particle.sprite.alpha = lifeRatio;
        const scale = 0.35 + 0.65 * lifeRatio;
        particle.sprite.width = particle.baseSize * scale;
        particle.sprite.height = particle.baseSize * scale;
      }
    }
  }
}
