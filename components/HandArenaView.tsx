"use client";

import { useEffect, useRef, useState } from "react";
import { CameraPermission } from "@/components/CameraPermission";
import {
  CameraFireballRenderer,
  type CameraFireballFrame,
} from "@/game/render/CameraFireballRenderer";
import {
  LightningRenderer,
  type LightningFrame,
} from "@/game/render/LightningRenderer";
import { selectSpell, type ActiveSpell } from "@/game/spells/spellSelect";
import {
  fingerBolts,
  findBeamHits,
  handStackOrientation,
} from "@/game/spells/pointerBeams";
import { CameraManager, type CameraStatus } from "@/vision/camera";
import { drawDebugOverlay } from "@/vision/drawDebugOverlay";
import { FeatureExtractor, type HandFeatures } from "@/vision/features";
import { HandLandmarkerService } from "@/vision/handLandmarker";
import { LandmarkSmoother } from "@/vision/landmarkSmoother";
import {
  assessTrackingQuality,
  qualityMessage,
  type TrackingQuality,
} from "@/vision/quality";
import type { Vec2, VisionFrame } from "@/vision/types";

const VISION_INTERVAL_MS = 1000 / 60;

/**
 * Camera-only Ember experience.
 *
 * Layer stack:
 *   mirrored webcam
 *   → landmark debug canvas
 *   → transparent Pixi fireball canvas
 *   → transparent Pixi lightning canvas
 *
 * No enemy arena and no cast state. Invisible beams from every fingertip
 * interact across hands. Vertical stack + open palms → fire; horizontal
 * stack + overlapping beams → lightning.
 */
export function HandArenaView() {
  const cameraStageRef = useRef<HTMLDivElement>(null);
  const fireballHostRef = useRef<HTMLDivElement>(null);
  const lightningHostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const fireballRef = useRef<CameraFireballRenderer | null>(null);
  const lightningRef = useRef<LightningRenderer | null>(null);
  const cameraRef = useRef(new CameraManager());
  const landmarkerRef = useRef<HandLandmarkerService | null>(null);
  const smootherRef = useRef(new LandmarkSmoother(0.55));
  const featureExtractorRef = useRef(new FeatureExtractor());
  const lastFrameRef = useRef<VisionFrame | null>(null);
  const featuresRef = useRef<HandFeatures | null>(null);
  const qualityRef = useRef<TrackingQuality>("NO_HANDS");
  const lastVisionAtRef = useRef(0);
  const visionFpsRef = useRef(0);
  const renderFpsRef = useRef(0);
  const inferMsRef = useRef(0);
  const rafRef = useRef(0);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [effectError, setEffectError] = useState<string | null>(null);
  const [quality, setQuality] = useState<TrackingQuality>("NO_HANDS");
  const [sizePercent, setSizePercent] = useState(0);
  const [spell, setSpell] = useState<ActiveSpell>(null);

  useEffect(() => {
    const host = fireballHostRef.current;
    if (!host) return;
    let cancelled = false;
    let renderer: CameraFireballRenderer | null = null;

    (async () => {
      try {
        renderer = await CameraFireballRenderer.create(host);
        if (cancelled) {
          renderer.destroy();
          return;
        }
        fireballRef.current = renderer;
      } catch (err) {
        if (!cancelled) {
          setEffectError(
            err instanceof Error ? err.message : "Fire effect failed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      renderer?.destroy();
      fireballRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = lightningHostRef.current;
    if (!host) return;
    let cancelled = false;
    let renderer: LightningRenderer | null = null;

    (async () => {
      try {
        renderer = await LightningRenderer.create(host);
        if (cancelled) {
          renderer.destroy();
          return;
        }
        lightningRef.current = renderer;
      } catch (err) {
        if (!cancelled) {
          setEffectError(
            err instanceof Error ? err.message : "Lightning effect failed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      renderer?.destroy();
      lightningRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const service = new HandLandmarkerService();
    landmarkerRef.current = service;

    (async () => {
      try {
        await service.initialize();
        if (!cancelled) setModelReady(true);
      } catch (err) {
        if (!cancelled) {
          setModelError(
            err instanceof Error ? err.message : "Model failed to load",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      service.dispose();
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      camera.stop();
      featureExtractorRef.current.reset();
      hideEffects();
    };
  }, []);

  async function enableCamera() {
    setErrorMessage(null);
    setStatus("requesting");
    try {
      const stream = await cameraRef.current.start();
      setStatus("ready");
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play();
      startVisionLoop();
    } catch {
      setStatus(cameraRef.current.status);
      setErrorMessage(cameraRef.current.errorMessage);
    }
  }

  function stopCamera() {
    cancelAnimationFrame(rafRef.current);
    cameraRef.current.stop();
    const video = videoRef.current;
    if (video) video.srcObject = null;
    featureExtractorRef.current.reset();
    lastFrameRef.current = null;
    featuresRef.current = null;
    qualityRef.current = "NO_HANDS";
    setStatus("stopped");
    setQuality("NO_HANDS");
    setSizePercent(0);
    setSpell(null);
    hideEffects();
    const ctx = debugCanvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  function hideEffects() {
    fireballRef.current?.update({ palms: null });
    lightningRef.current?.update({ bolts: [] });
  }

  function startVisionLoop() {
    cancelAnimationFrame(rafRef.current);
    let frames = 0;
    let fpsWindowStart = performance.now();

    const tick = (now: number) => {
      const video = videoRef.current;
      const canvas = debugCanvasRef.current;
      const landmarker = landmarkerRef.current;

      if (video && canvas && landmarker && modelReady && video.readyState >= 2) {
        const w = video.clientWidth;
        const h = video.clientHeight;
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
          canvas.width = w;
          canvas.height = h;
        }

        if (now - lastVisionAtRef.current >= VISION_INTERVAL_MS) {
          const dt = now - lastVisionAtRef.current;
          lastVisionAtRef.current = now;
          if (dt > 0) visionFpsRef.current = 1000 / dt;

          try {
            const raw = landmarker.detect(video, now);
            inferMsRef.current = raw.inferenceMs;
            const smoothed = smootherRef.current.apply(raw);
            const features = featureExtractorRef.current.extract(smoothed);
            const nextQuality = assessTrackingQuality(smoothed, features, {
              requiredHands: 2,
            });
            const palms = palmPair(smoothed);
            const stack =
              palms === null
                ? null
                : handStackOrientation(palms[0], palms[1]);
            const hits =
              smoothed.hands.length >= 2
                ? findBeamHits(smoothed.hands[0], smoothed.hands[1])
                : [];

            const active = selectSpell({
              features,
              stack,
              beamsOverlap: hits.length > 0,
            });
            const fireballActive = active === "fireball";
            const lightningActive = active === "lightning";

            lastFrameRef.current = smoothed;
            featuresRef.current = features;
            qualityRef.current = nextQuality;
            setQuality((old) =>
              old === nextQuality ? old : nextQuality,
            );
            setSpell((old) => (old === active ? old : active));
            const nextSize = palmGapPercent(palms, w, h);
            setSizePercent((old) =>
              old === nextSize ? old : nextSize,
            );

            const fireballFrame: CameraFireballFrame = {
              palms: fireballActive ? palms : null,
            };
            const lightningFrame: LightningFrame = {
              bolts:
                lightningActive && smoothed.hands.length >= 2
                  ? fingerBolts(smoothed.hands[0], smoothed.hands[1])
                  : [],
            };
            fireballRef.current?.update(fireballFrame);
            lightningRef.current?.update(lightningFrame);
          } catch {
            // One malformed frame should not stop camera loop.
          }
        }

        const ctx = canvas.getContext("2d");
        const frame = lastFrameRef.current;
        if (ctx && frame) {
          drawDebugOverlay(ctx, frame, {
            renderFps: renderFpsRef.current,
            visionFps: visionFpsRef.current,
            inferenceMs: inferMsRef.current,
            features: featuresRef.current,
            quality: qualityRef.current,
          });
        }
      }

      frames += 1;
      const elapsed = now - fpsWindowStart;
      if (elapsed >= 500) {
        renderFpsRef.current = (frames * 1000) / elapsed;
        frames = 0;
        fpsWindowStart = now;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <div className="space-y-4">
      <div
        ref={cameraStageRef}
        className="relative aspect-video overflow-hidden rounded-xl border border-ember/25 bg-black shadow-[0_0_80px_rgba(255,90,0,0.12)]"
      >
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas
          ref={debugCanvasRef}
          className="absolute inset-0 z-10 h-full w-full"
        />
        <div
          ref={fireballHostRef}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden="true"
        />
        <div
          ref={lightningHostRef}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden="true"
        />
        <CameraPermission
          status={status}
          errorMessage={errorMessage}
          onEnable={enableCamera}
        />

        {modelError && (
          <div className="absolute bottom-3 left-3 right-3 z-30 rounded bg-black/80 px-3 py-2 text-xs text-ember">
            {modelError}
          </div>
        )}
        {effectError && (
          <div className="absolute bottom-3 left-3 right-3 z-30 rounded bg-black/80 px-3 py-2 text-xs text-ember">
            {effectError}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-foreground/10">
          <div
            className={`h-full transition-[width] duration-100 ${
              spell === "lightning"
                ? "bg-gradient-to-r from-indigo-600 via-violet-400 to-sky-200"
                : "bg-gradient-to-r from-red-600 via-ember to-amber-200"
            }`}
            style={{ width: `${Math.min(sizePercent, 100)}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-xs text-foreground/60">
          <span>
            spell: {spell === null ? "none" : spell.toUpperCase()}
          </span>
          <span>reach: {sizePercent}%</span>
          <span>quality: {quality}</span>
          <span>{qualityMessage(quality)}</span>
          <span>camera: {status}</span>
          <span>
            model: {modelReady ? "ready" : modelError ? "error" : "loading"}
          </span>
          {status === "ready" && (
            <button
              type="button"
              onClick={stopCamera}
              className="text-foreground/60 underline decoration-foreground/25 underline-offset-4 hover:text-foreground"
            >
              Stop camera
            </button>
          )}
        </div>
      </div>

      <p className="text-sm text-foreground/65">
        Stack hands vertically with open palms for fire. Hold them side by
        side so fingertip beams cross for lightning. Beams stay invisible —
        only the arc shows.
      </p>
    </div>
  );
}

/**
 * Preserve both raw palm centers.
 * Pixi uses midpoint for position and screen-space separation for size.
 */
function palmPair(
  frame: VisionFrame,
): readonly [Vec2, Vec2] | null {
  if (frame.hands.length < 2) return null;
  return [
    frame.hands[0].palmCenter,
    frame.hands[1].palmCenter,
  ] as const;
}

/** Match UI size meter to renderer's screen-space palm-gap formula. */
function palmGapPercent(
  palms: readonly [Vec2, Vec2] | null,
  width: number,
  height: number,
): number {
  if (!palms || width <= 0 || height <= 0) return 0;
  const dx = (palms[1].x - palms[0].x) * width;
  const dy = (palms[1].y - palms[0].y) * height;
  const gap = Math.hypot(dx, dy);
  // Radius is uncapped; report percent relative to a screen reference so the
  // meter can read past 100% as the orb grows beyond the frame.
  const radius = Math.max(14, gap * 0.26);
  const referenceRadius = Math.min(width, height) * 0.25;
  return Math.round((radius / Math.max(referenceRadius, 1)) * 100);
}
