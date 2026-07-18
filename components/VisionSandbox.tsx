"use client";

import { useEffect, useRef, useState } from "react";
import { CameraPermission } from "@/components/CameraPermission";
import { CameraManager, type CameraStatus } from "@/vision/camera";
import {
  computePalmDistance,
  drawDebugOverlay,
} from "@/vision/drawDebugOverlay";
import { HandLandmarkerService } from "@/vision/handLandmarker";
import { LandmarkSmoother } from "@/vision/landmarkSmoother";
import type { VisionFrame } from "@/vision/types";

const VISION_INTERVAL_MS = 40; // ~25 Hz inference

export function VisionSandbox() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cameraRef = useRef(new CameraManager());
  const landmarkerRef = useRef<HandLandmarkerService | null>(null);
  const smootherRef = useRef(new LandmarkSmoother(0.55));
  const lastFrameRef = useRef<VisionFrame | null>(null);
  const lastVisionAtRef = useRef(0);
  const visionFpsRef = useRef(0);
  const renderFpsRef = useRef(0);
  const inferMsRef = useRef(0);
  const rafRef = useRef(0);

  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [handCount, setHandCount] = useState(0);

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
          setModelError(err instanceof Error ? err.message : "Model failed to load");
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

      if (video && canvas && landmarker && modelReady && video.readyState >= 2) {
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
            lastFrameRef.current = smoothed;
            setHandCount(smoothed.hands.length);
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
            palmDistance: computePalmDistance(frame.hands),
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
        <span>mirror: on</span>
      </div>
    </div>
  );
}
