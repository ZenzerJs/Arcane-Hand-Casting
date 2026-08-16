"use client";

import { useEffect, useRef, useState } from "react";
import { CameraPermission } from "@/components/CameraPermission";
import { CameraManager, type CameraStatus } from "@/vision/camera";
import { drawDebugOverlay } from "@/vision/drawDebugOverlay";
import { FeatureExtractor, type HandFeatures } from "@/vision/features";
import { sortHands } from "@/vision/handOrder";
import { HandLandmarkerService } from "@/vision/handLandmarker";
import { LandmarkSmoother } from "@/vision/landmarkSmoother";
import {
  assessTrackingQuality,
  qualityMessage,
  type TrackingQuality,
} from "@/vision/quality";
import type { VisionFrame } from "@/vision/types";

const VISION_INTERVAL_MS = 1000 / 60; // ~60 Hz inference

export function VisionSandbox() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef(new CameraManager());
  const landmarkerRef = useRef<HandLandmarkerService | null>(null);
  const smootherRef = useRef(new LandmarkSmoother(0.55));
  // Owns ~300 ms of history needed for velocity and stability.
  const featureExtractorRef = useRef(new FeatureExtractor());
  const lastFrameRef = useRef<VisionFrame | null>(null);
  const lastVisionAtRef = useRef(0);
  const visionFpsRef = useRef(0);
  const renderFpsRef = useRef(0);
  const inferMsRef = useRef(0);
  const featuresRef = useRef<HandFeatures | null>(null);
  const qualityRef = useRef<TrackingQuality>("NO_HANDS");
  const rafRef = useRef(0);
  // Mirrors `modelReady` for the RAF loop (state would be a stale closure).
  const modelReadyRef = useRef(false);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [handCount, setHandCount] = useState(0);
  const [facingLabel, setFacingLabel] = useState("—");
  const [featureLabel, setFeatureLabel] = useState("—");
  const [quality, setQuality] = useState<TrackingQuality>("NO_HANDS");

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
          setModelError(err instanceof Error ? err.message : "Model failed to load");
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
      startLoops();
    } catch {
      setStatus(cameraRef.current.status);
      setErrorMessage(cameraRef.current.errorMessage);
    }
  }

  function startLoops() {
    cancelAnimationFrame(rafRef.current);
    let frames = 0;
    let fpsWindowStart = performance.now();

    const tick = (now: number) => {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;

      if (
        video &&
        canvas &&
        landmarker &&
        modelReadyRef.current &&
        video.readyState >= 2
      ) {
        // Keep canvas pixel size matched to displayed video box.
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
            const ordered = { ...smoothed, hands: sortHands(smoothed.hands) };
            // Stage 3: geometry + short history become spell-ready signals.
            const features = featureExtractorRef.current.extract(ordered);
            // Sandbox targets Ember first, so quality currently requires 2 hands.
            const nextQuality = assessTrackingQuality(ordered, features, {
              requiredHands: 2,
            });
            lastFrameRef.current = ordered;
            featuresRef.current = features;
            qualityRef.current = nextQuality;
            setHandCount(ordered.hands.length);
            setQuality(nextQuality);
            setFacingLabel(
              ordered.hands.length === 0
                ? "—"
                : ordered.hands
                    .map((h) => `${h.id}:${h.palmFacing}`)
                    .join(" · "),
            );
            setFeatureLabel(
              features.handCount === 0
                ? "—"
                : `open ${features.meanOpenness.toFixed(2)} · dist ${
                    features.palmDistance === null
                      ? "—"
                      : features.palmDistance.toFixed(2)
                  } · speed ${meanFeature(features, "speed")} · fwd ${meanFeature(
                    features,
                    "forwardVelocity",
                  )} · stable ${meanStability(features)}`,
            );
          } catch {
            // Skip bad frames (e.g. timestamp edge cases)
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
        frames = 0;
        fpsWindowStart = now;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-video overflow-hidden rounded-lg border border-foreground/15 bg-black">
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full scale-x-[-1] object-cover"
          playsInline
          muted
          autoPlay
        />
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <CameraPermission status={status} errorMessage={errorMessage} onEnable={enableCamera} />

        {!modelReady && status === "ready" && (
          <div className="absolute bottom-3 left-3 rounded bg-black/60 px-3 py-1 text-xs text-foreground/80">
            Loading hand model…
          </div>
        )}
        {modelError && (
          <div className="absolute bottom-3 left-3 right-3 rounded bg-black/70 px-3 py-2 text-xs text-ember">
            {modelError}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-foreground/55 font-mono">
        <span>camera: {status}</span>
        <span>model: {modelReady ? "ready" : modelError ? "error" : "loading"}</span>
        <span>hands: {handCount}</span>
        <span>facing: {facingLabel}</span>
        <span>features: {featureLabel}</span>
        <span>quality: {quality} — {qualityMessage(quality)}</span>
        <span>mirror: on</span>
      </div>
    </div>
  );
}

/**
 * Average one numeric per-hand feature for compact debug text.
 * Empty frames use an em dash instead of pretending the value is zero.
 */
function meanFeature(
  features: HandFeatures,
  key: "speed" | "forwardVelocity",
): string {
  if (features.hands.length === 0) return "—";
  const mean =
    features.hands.reduce((sum, hand) => sum + hand[key], 0) /
    features.hands.length;
  return mean.toFixed(2);
}

/** Average available stability values; early frames show — until history fills. */
function meanStability(features: HandFeatures): string {
  const values = features.hands
    .map((hand) => hand.stability)
    .filter((value): value is number => value !== null);
  if (values.length === 0) return "—";
  return (
    values.reduce((sum, value) => sum + value, 0) / values.length
  ).toFixed(2);
}
