/**
 * MediaPipe Hand Landmarker wrapper.
 * Loads model from /models and runs VIDEO-mode inference.
 */

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { estimatePalmFacing } from "./palmFacing";
import type { HandFrame, HandId, Vec2, Vec3, VisionFrame } from "./types";

const DEFAULT_MODEL_PATH = "/models/hand_landmarker.task";
// Served from public/wasm (copied from node_modules on postinstall).
// jsDelivr @0.10.22/wasm currently 404s.
const DEFAULT_WASM_PATH = "/wasm";

/**
 * MediaPipe always returns 21 landmarks per detected hand.
 * Naming the indices makes the geometry below easier to read.
 */
const WRIST = 0;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const RING_MCP = 13;
const PINKY_MCP = 17;
const INDEX_TIP = 8;

/** Keep x/y/z. z is relative depth (smaller = closer to camera). */
function toVec3(landmark: { x: number; y: number; z: number }): Vec3 {
  return { x: landmark.x, y: landmark.y, z: landmark.z };
}

/**
 * Approximate the palm center by averaging the wrist and four knuckles.
 * This point becomes a stable anchor for spell effects.
 */
function palmCenter(landmarks: Vec3[]): Vec2 {
  const points = [
    landmarks[WRIST],
    landmarks[INDEX_MCP],
    landmarks[MIDDLE_MCP],
    landmarks[RING_MCP],
    landmarks[PINKY_MCP],
  ];
  const sum = points.reduce(
    (acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / points.length, y: sum.y / points.length };
}

function mapHandedness(label: string | undefined): HandId {
  if (label === "Left") return "left";
  if (label === "Right") return "right";
  return "unknown";
}

/**
 * Owns the MediaPipe model for its full lifecycle:
 * load once, analyze many video frames, then release resources.
 */
export class HandLandmarkerService {
  // Null before initialize() and after dispose().
  private landmarker: HandLandmarker | null = null;
  // MediaPipe VIDEO mode rejects timestamps that move backward or repeat.
  private lastVideoTimestamp = -1;

  /** Load WASM runtime and hand model. Safe to call more than once. */
  async initialize(options?: {
    modelAssetPath?: string;
    wasmPath?: string;
    numHands?: number;
  }): Promise<void> {
    if (this.landmarker) return;

    const wasmPath = options?.wasmPath ?? DEFAULT_WASM_PATH;
    const modelAssetPath = options?.modelAssetPath ?? DEFAULT_MODEL_PATH;

    // FilesetResolver locates the JavaScript/WASM files needed by MediaPipe.
    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    // Shared detection settings for both GPU and CPU initialization.
    const common = {
      runningMode: "VIDEO" as const,
      numHands: options?.numHands ?? 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    try {
      // GPU gives lower inference time on supported browsers and devices.
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions: { modelAssetPath, delegate: "GPU" },
      });
    } catch {
      // Some browsers cannot create the GPU delegate, so keep CPU fallback.
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions: { modelAssetPath, delegate: "CPU" },
      });
    }
  }

  /** Analyze one video frame and convert MediaPipe output to game types. */
  detect(video: HTMLVideoElement, timestampMs: number): VisionFrame {
    if (!this.landmarker) {
      throw new Error("HandLandmarkerService not initialized");
    }

    // MediaPipe requires strictly increasing timestamps in VIDEO mode.
    let ts = timestampMs;
    if (ts <= this.lastVideoTimestamp) {
      ts = this.lastVideoTimestamp + 1;
    }
    this.lastVideoTimestamp = ts;

    const started = performance.now();
    const result = this.landmarker.detectForVideo(video, ts);
    const inferenceMs = performance.now() - started;

    // MediaPipe stores landmark and handedness results in parallel arrays.
    const hands: HandFrame[] = [];
    const landmarkSets = result.landmarks ?? [];
    const handedness = result.handedness ?? [];

    for (let i = 0; i < landmarkSets.length; i++) {
      const raw = landmarkSets[i];
      const landmarks = raw.map(toVec3);
      const category = handedness[i]?.[0];
      const id = mapHandedness(category?.categoryName);
      const { facing, towardScore } = estimatePalmFacing(landmarks, id);

      // Save landmarks, anchors, and palm-facing proxy for spell features.
      hands.push({
        id,
        timestampMs: ts,
        landmarks,
        wrist: { x: landmarks[WRIST].x, y: landmarks[WRIST].y },
        palmCenter: palmCenter(landmarks),
        indexTip: { x: landmarks[INDEX_TIP].x, y: landmarks[INDEX_TIP].y },
        confidence: category?.score ?? 0,
        palmFacing: facing,
        palmTowardScore: towardScore,
      });
    }

    return { timestampMs: ts, hands, inferenceMs };
  }

  /** Release MediaPipe resources when the React component unmounts. */
  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastVideoTimestamp = -1;
  }
}
