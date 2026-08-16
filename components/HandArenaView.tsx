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
import {
  AegisRenderer,
  type AegisFrame,
} from "@/game/render/AegisRenderer";
import {
  EmberFistRenderer,
  type EmberFistFrame,
} from "@/game/render/EmberFistRenderer";
import { TrialRenderer } from "@/game/render/TrialRenderer";
import {
  createTrial,
  startTrial,
  stepTrial,
  trialConfig,
  type TrialInput,
  type TrialState,
} from "@/game/trial/trial";
import { emberGraspConfig } from "@/game/config/spells";
import { selectSpell, type ActiveSpell } from "@/game/spells/spellSelect";
import { fingerBolts, handStackOrientation } from "@/game/spells/pointerBeams";
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
import { sortHands } from "@/vision/handOrder";
import type { Vec2, VisionFrame } from "@/vision/types";

const VISION_INTERVAL_MS = 1000 / 60;

/**
 * Camera-only spell experience.
 *
 * Layer stack:
 *   mirrored webcam
 *   → landmark debug canvas
 *   → transparent Pixi spell canvases (fire, lightning, aegis, ember)
 *
 * Vertical stack + open palms → fire; horizontal stack + open hands →
 * lightning; one open palm → aegis; one closed fist → ember.
 */
export function HandArenaView() {
  const cameraStageRef = useRef<HTMLDivElement>(null);
  const fireballHostRef = useRef<HTMLDivElement>(null);
  const lightningHostRef = useRef<HTMLDivElement>(null);
  const aegisHostRef = useRef<HTMLDivElement>(null);
  const emberHostRef = useRef<HTMLDivElement>(null);
  const trialHostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const debugCanvasRef = useRef<HTMLCanvasElement>(null);
  const fireballRef = useRef<CameraFireballRenderer | null>(null);
  const lightningRef = useRef<LightningRenderer | null>(null);
  const aegisRef = useRef<AegisRenderer | null>(null);
  const emberRef = useRef<EmberFistRenderer | null>(null);
  const trialRendererRef = useRef<TrialRenderer | null>(null);
  const trialStateRef = useRef<TrialState>(createTrial());
  const lastTrialStepRef = useRef(0);
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
  // Mirrors `modelReady` for the RAF loop. State is a snapshot in the
  // closure that starts the loop, so reading it there would go stale if the
  // camera was enabled before the model finished loading.
  const modelReadyRef = useRef(false);
  // Intrinsic video size, pushed to renderers so overlays track the
  // `object-cover` crop instead of assuming the frame fills the box.
  const videoSizeRef = useRef({ w: 0, h: 0 });

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [effectError, setEffectError] = useState<string | null>(null);
  const [quality, setQuality] = useState<TrackingQuality>("NO_HANDS");
  const [sizePercent, setSizePercent] = useState(0);
  const [spell, setSpell] = useState<ActiveSpell>(null);
  const [trialHud, setTrialHud] = useState({
    status: "idle" as TrialState["status"],
    wave: 0,
    score: 0,
    lives: trialConfig.lives as number,
  });
  const [fps, setFps] = useState(0);

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
    const host = aegisHostRef.current;
    if (!host) return;
    let cancelled = false;
    let renderer: AegisRenderer | null = null;

    (async () => {
      try {
        renderer = await AegisRenderer.create(host);
        if (cancelled) {
          renderer.destroy();
          return;
        }
        aegisRef.current = renderer;
      } catch (err) {
        if (!cancelled) {
          setEffectError(
            err instanceof Error ? err.message : "Aegis effect failed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      renderer?.destroy();
      aegisRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = emberHostRef.current;
    if (!host) return;
    let cancelled = false;
    let renderer: EmberFistRenderer | null = null;

    (async () => {
      try {
        renderer = await EmberFistRenderer.create(host);
        if (cancelled) {
          renderer.destroy();
          return;
        }
        emberRef.current = renderer;
      } catch (err) {
        if (!cancelled) {
          setEffectError(
            err instanceof Error ? err.message : "Ember effect failed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      renderer?.destroy();
      emberRef.current = null;
    };
  }, []);

  useEffect(() => {
    const host = trialHostRef.current;
    if (!host) return;
    let cancelled = false;
    let renderer: TrialRenderer | null = null;

    (async () => {
      try {
        renderer = await TrialRenderer.create(host);
        if (cancelled) {
          renderer.destroy();
          return;
        }
        trialRendererRef.current = renderer;
      } catch (err) {
        if (!cancelled) {
          setEffectError(
            err instanceof Error ? err.message : "Trial effect failed",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      renderer?.destroy();
      trialRendererRef.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const service = new HandLandmarkerService();
    landmarkerRef.current = service;

    (async () => {
      try {
        await service.initialize();
        if (!cancelled) {
          modelReadyRef.current = true;
          setModelReady(true);
        }
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
      modelReadyRef.current = false;
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const camera = cameraRef.current;
    const extractor = featureExtractorRef.current;
    return () => {
      cancelAnimationFrame(rafRef.current);
      camera.stop();
      extractor.reset();
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
    endTrial();
    hideEffects();
    const ctx = debugCanvasRef.current?.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  }

  function hideEffects() {
    fireballRef.current?.update({ palms: null });
    lightningRef.current?.update({ bolts: [] });
    aegisRef.current?.update({ palm: null, palmWidth: 0.2 });
    emberRef.current?.update({ fist: null, palmWidth: 0.2 });
    trialRendererRef.current?.update({
      wisps: [],
      hazards: [],
      running: false,
    });
  }

  function syncTrialHud() {
    const s = trialStateRef.current;
    setTrialHud((old) =>
      old.status === s.status &&
      old.wave === s.wave &&
      old.score === s.score &&
      old.lives === s.lives
        ? old
        : { status: s.status, wave: s.wave, score: s.score, lives: s.lives },
    );
  }

  function beginTrial() {
    trialStateRef.current = startTrial(trialStateRef.current, performance.now());
    lastTrialStepRef.current = performance.now();
    syncTrialHud();
  }

  function endTrial() {
    trialStateRef.current = createTrial();
    trialRendererRef.current?.update({
      wisps: [],
      hazards: [],
      running: false,
    });
    syncTrialHud();
  }

  function startVisionLoop() {
    cancelAnimationFrame(rafRef.current);
    let frames = 0;
    let fpsWindowStart = performance.now();

    const tick = (now: number) => {
      const video = videoRef.current;
      const canvas = debugCanvasRef.current;
      const landmarker = landmarkerRef.current;

      if (
        video &&
        canvas &&
        landmarker &&
        modelReadyRef.current &&
        video.readyState >= 2
      ) {
        const w = video.clientWidth;
        const h = video.clientHeight;
        if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
          canvas.width = w;
          canvas.height = h;
        }

        if (
          video.videoWidth > 0 &&
          (video.videoWidth !== videoSizeRef.current.w ||
            video.videoHeight !== videoSizeRef.current.h)
        ) {
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          videoSizeRef.current = { w: vw, h: vh };
          fireballRef.current?.setVideoSize(vw, vh);
          lightningRef.current?.setVideoSize(vw, vh);
          aegisRef.current?.setVideoSize(vw, vh);
          emberRef.current?.setVideoSize(vw, vh);
          trialRendererRef.current?.setVideoSize(vw, vh);
        }

        if (now - lastVisionAtRef.current >= VISION_INTERVAL_MS) {
          const dt = now - lastVisionAtRef.current;
          lastVisionAtRef.current = now;
          if (dt > 0) visionFpsRef.current = 1000 / dt;

          try {
            const raw = landmarker.detect(video, now);
            inferMsRef.current = raw.inferenceMs;
            const smoothed = smootherRef.current.apply(raw);
            // MediaPipe can swap hand order between frames; a stable order
            // keeps lightning arcs and palm pairs anchored to the same hand.
            const ordered = { ...smoothed, hands: sortHands(smoothed.hands) };
            const features = featureExtractorRef.current.extract(ordered);
            const palms = palmPair(ordered);
            const stack =
              palms === null
                ? null
                : handStackOrientation(palms[0], palms[1]);

            const active = selectSpell({ features, stack });
            // Aegis and Ember are one-hand spells — never nag "Show both
            // hands" while the ward or fist is actively held.
            const nextQuality = assessTrackingQuality(ordered, features, {
              requiredHands:
                active === "aegis" || active === "ember" ? 1 : 2,
            });
            const fireballActive = active === "fireball";
            const lightningActive = active === "lightning";
            const aegisActive = active === "aegis";
            const emberActive = active === "ember";

            lastFrameRef.current = ordered;
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
                lightningActive && ordered.hands.length >= 2
                  ? fingerBolts(ordered.hands[0], ordered.hands[1])
                  : [],
            };
            const aegisFrame: AegisFrame =
              aegisActive && ordered.hands.length >= 1
                ? {
                    palm: ordered.hands[0].palmCenter,
                    palmWidth: features.hands[0]?.palmWidth ?? 0.2,
                  }
                : { palm: null, palmWidth: 0.2 };
            const emberFrame: EmberFistFrame =
              emberActive && ordered.hands.length >= 1
                ? {
                    fist: ordered.hands[0].palmCenter,
                    palmWidth: features.hands[0]?.palmWidth ?? 0.2,
                  }
                : { fist: null, palmWidth: 0.2 };
            fireballRef.current?.update(fireballFrame);
            lightningRef.current?.update(lightningFrame);
            aegisRef.current?.update(aegisFrame);
            emberRef.current?.update(emberFrame);

            // Stage 8 trial — spells act on wisps/hazards in normalized space.
            const trial = trialStateRef.current;
            if (trial.status === "running") {
              const voidCenter =
                fireballActive && palms
                  ? {
                      x: (palms[0].x + palms[1].x) / 2,
                      y: (palms[0].y + palms[1].y) / 2,
                    }
                  : null;
              const voidRadius =
                voidCenter && palms
                  ? Math.max(
                      0.04,
                      Math.hypot(
                        palms[1].x - palms[0].x,
                        palms[1].y - palms[0].y,
                      ) * 0.22,
                    )
                  : 0;
              const trialInput: TrialInput = {
                voidCenter,
                voidRadius,
                arcs: lightningFrame.bolts
                  .filter((b) => b.kind === "arc")
                  .map((b) => ({ from: b.from, to: b.to })),
                aegis:
                  aegisFrame.palm !== null
                    ? {
                        center: aegisFrame.palm,
                        radius: Math.max(0.07, aegisFrame.palmWidth * 1.15),
                      }
                    : null,
                ember:
                  emberFrame.fist !== null
                    ? {
                        center: emberFrame.fist,
                        radius: Math.max(
                          emberGraspConfig.burnRadius,
                          emberFrame.palmWidth * 0.9,
                        ),
                      }
                    : null,
              };
              const stepDt = now - lastTrialStepRef.current;
              lastTrialStepRef.current = now;
              const events = stepTrial(trial, trialInput, stepDt, now);
              if (events.length > 0) {
                trialRendererRef.current?.pushEvents(events);
              }
              syncTrialHud();
            }
            trialRendererRef.current?.update({
              wisps: trial.wisps,
              hazards: trial.hazards,
              running: trial.status === "running",
            });
          } catch {
            // One malformed frame should not stop camera loop —
            // still wipe effects so bolts never ghost on screen.
            hideEffects();
          }
        }

        const ctx = canvas.getContext("2d");
        const frame = lastFrameRef.current;
        if (ctx && frame) {
          drawDebugOverlay(ctx, frame, {
            renderFps: renderFpsRef.current,
            visionFps: visionFpsRef.current,
            inferenceMs: inferMsRef.current,
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            features: featuresRef.current,
            quality: qualityRef.current,
          });
        }
      }

      frames += 1;
      const elapsed = now - fpsWindowStart;
      if (elapsed >= 500) {
        renderFpsRef.current = (frames * 1000) / elapsed;
        setFps(Math.round(renderFpsRef.current));
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
        className={`relative aspect-video overflow-hidden rounded-2xl border bg-black transition-[border-color,box-shadow] duration-500 ${
          spell === "fireball"
            ? "border-rune/60 shadow-[25px_0_90px_rgba(106,91,255,0.26),-25px_0_90px_rgba(255,122,58,0.24)]"
            : spell === "lightning"
              ? "border-storm/50 shadow-[0_0_90px_rgba(139,108,255,0.24)]"
              : spell === "aegis"
                ? "border-aegis/50 shadow-[0_0_90px_rgba(61,224,208,0.2)]"
                : spell === "ember"
                  ? "border-ember/50 shadow-[0_0_90px_rgba(255,122,58,0.24)]"
                  : "border-foreground/15 shadow-[0_0_60px_rgba(139,108,255,0.08)]"
        }`}
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
        <div
          ref={aegisHostRef}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden="true"
        />
        <div
          ref={emberHostRef}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden="true"
        />
        <div
          ref={trialHostRef}
          className="pointer-events-none absolute inset-0 z-20"
          aria-hidden="true"
        />

        {/* Trial scoreboard overlay */}
        {trialHud.status !== "idle" && (
          <div className="absolute left-3 top-3 z-30 flex items-center gap-2">
            <span className="rounded-full border border-foreground/15 bg-black/60 px-3 py-1.5 font-mono text-xs text-foreground/90 backdrop-blur-sm">
              wave {trialHud.wave}
            </span>
            <span className="rounded-full border border-foreground/15 bg-black/60 px-3 py-1.5 font-mono text-xs text-foreground/90 backdrop-blur-sm">
              {trialHud.score} pts
            </span>
            <span
              className="flex items-center gap-1 rounded-full border border-foreground/15 bg-black/60 px-3 py-1.5 backdrop-blur-sm"
              aria-label={`${trialHud.lives} lives remaining`}
            >
              {Array.from({ length: trialConfig.lives }, (_, i) => (
                <svg
                  key={i}
                  viewBox="0 0 16 16"
                  className={`h-3 w-3 ${
                    i < trialHud.lives ? "text-ember" : "text-foreground/20"
                  }`}
                  aria-hidden="true"
                >
                  <path
                    d="M8 14 2.6 8.4a3.4 3.4 0 0 1 4.8-4.8L8 4.2l.6-.6a3.4 3.4 0 0 1 4.8 4.8L8 14z"
                    fill="currentColor"
                  />
                </svg>
              ))}
            </span>
          </div>
        )}

        {trialHud.status === "over" && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/55 backdrop-blur-sm">
            <p className="font-mono text-xs uppercase tracking-[0.3em] text-ember">
              Trial ended
            </p>
            <p className="font-display text-4xl font-bold tracking-tight text-foreground">
              {trialHud.score} pts
            </p>
            <p className="text-sm text-foreground/60">
              Reached wave {trialHud.wave}
            </p>
            <button
              type="button"
              onClick={beginTrial}
              className="mt-2 rounded-full border border-rune/50 bg-rune/15 px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-rune/25"
            >
              Try again
            </button>
          </div>
        )}

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

      <div className="space-y-3">
        {/* Charge / reach meter */}
        <div className="relative h-2.5 overflow-hidden rounded-full bg-foreground/10">
          <div
            className={`relative h-full rounded-full transition-[width] duration-150 ease-out ${
              spell === "lightning"
                ? "bg-gradient-to-r from-indigo-600 via-violet-400 to-sky-200"
                : spell === "aegis"
                  ? "bg-gradient-to-r from-teal-600 via-aegis to-cyan-100"
                  : spell === "ember"
                    ? "bg-gradient-to-r from-amber-400 via-ember to-red-500"
                    : "bg-gradient-to-r from-ember via-black to-rune"
            }`}
            style={{
              width: `${
                spell === "aegis" || spell === "ember"
                  ? 100
                  : Math.min(sizePercent, 100)
              }%`,
            }}
          >
            {spell !== null && (
              <span className="shimmer-sweep absolute inset-0 block bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            )}
          </div>
        </div>

        {/* Status row */}
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors duration-300 ${
              spell === "fireball"
                ? "border-rune/60 bg-gradient-to-r from-ember/10 to-rune/15 text-storm"
                : spell === "lightning"
                  ? "border-storm/50 bg-storm/10 text-storm"
                  : spell === "aegis"
                    ? "border-aegis/50 bg-aegis/10 text-aegis"
                    : spell === "ember"
                      ? "border-ember/50 bg-ember/10 text-ember"
                      : "border-foreground/15 bg-surface/70 text-foreground/45"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                spell === "fireball"
                  ? "anim-pulse-soft bg-rune"
                  : spell === "lightning"
                    ? "anim-pulse-soft bg-storm"
                    : spell === "aegis"
                      ? "anim-pulse-soft bg-aegis"
                      : spell === "ember"
                        ? "anim-pulse-soft bg-ember"
                        : "bg-foreground/30"
              }`}
            />
            {spell === "fireball"
              ? "Void Singularity"
              : spell === "lightning"
                ? "Storm Weave"
                : spell === "aegis"
                  ? "Aegis Ward"
                  : spell === "ember"
                    ? "Ember Grasp"
                    : "Attuning"}
          </span>

          <span className="flex items-center gap-2 rounded-full border border-foreground/10 bg-surface/70 px-3.5 py-1.5 font-mono text-xs text-foreground/60">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                quality === "GOOD" ? "bg-aegis" : "bg-ember/70"
              }`}
            />
            {qualityMessage(quality)}
          </span>

          {spell !== "aegis" && spell !== "ember" && sizePercent > 0 && (
            <span className="rounded-full border border-foreground/10 bg-surface/70 px-3.5 py-1.5 font-mono text-xs text-foreground/60">
              reach {sizePercent}%
            </span>
          )}

          <span className="rounded-full border border-foreground/10 bg-surface/70 px-3.5 py-1.5 font-mono text-xs text-foreground/45">
            {modelReady ? "model ready" : modelError ? "model error" : "model loading"}
          </span>

          {status === "ready" && fps > 0 && (
            <span
              className={`rounded-full border border-foreground/10 bg-surface/70 px-3.5 py-1.5 font-mono text-xs ${
                fps >= 30 ? "text-foreground/45" : "text-ember"
              }`}
            >
              {fps} fps
            </span>
          )}

          {status === "ready" && (
            <div className="ml-auto flex items-center gap-2">
              {trialHud.status === "running" ? (
                <button
                  type="button"
                  onClick={endTrial}
                  className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs text-foreground/60 transition-colors hover:border-ember/50 hover:text-ember"
                >
                  End trial
                </button>
              ) : (
                <button
                  type="button"
                  onClick={beginTrial}
                  className="rounded-full border border-rune/50 bg-rune/15 px-3.5 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-rune/25"
                >
                  Begin trial
                </button>
              )}
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-full border border-foreground/15 px-3.5 py-1.5 text-xs text-foreground/60 transition-colors hover:border-ember/50 hover:text-ember"
              >
                Stop camera
              </button>
            </div>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-foreground/55">
        Stack open palms vertically to form a singularity. Hold both open hands
        side by side and arcs leap fingertip to fingertip. Raise one open palm to
        ward, or clench a fist to gather embers. Begin a trial to hunt wisps and
        block diving hazard bolts with the ward.
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
