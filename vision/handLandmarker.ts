/**
 * MediaPipe Hand Landmarker wrapper.
 * Loads model from /models and runs VIDEO-mode inference.
 */

import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import type { HandFrame, HandId, Vec2, VisionFrame } from "./types";

const DEFAULT_MODEL_PATH = "/models/hand_landmarker.task";
const DEFAULT_WASM_PATH =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm";

/** MediaPipe landmark indices */
const WRIST = 0;
const INDEX_MCP = 5;
const MIDDLE_MCP = 9;
const RING_MCP = 13;
const PINKY_MCP = 17;
const INDEX_TIP = 8;

function toVec2(landmark: { x: number; y: number }): Vec2 {
  return { x: landmark.x, y: landmark.y };
}

function palmCenter(landmarks: Vec2[]): Vec2 {
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

export class HandLandmarkerService {
  private landmarker: HandLandmarker | null = null;
  private lastVideoTimestamp = -1;

  async initialize(options?: {
    modelAssetPath?: string;
    wasmPath?: string;
    numHands?: number;
  }): Promise<void> {
    if (this.landmarker) return;

    const wasmPath = options?.wasmPath ?? DEFAULT_WASM_PATH;
    const modelAssetPath = options?.modelAssetPath ?? DEFAULT_MODEL_PATH;

    const vision = await FilesetResolver.forVisionTasks(wasmPath);
    const common = {
      runningMode: "VIDEO" as const,
      numHands: options?.numHands ?? 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    };

    try {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions: { modelAssetPath, delegate: "GPU" },
      });
    } catch {
      this.landmarker = await HandLandmarker.createFromOptions(vision, {
        ...common,
        baseOptions: { modelAssetPath, delegate: "CPU" },
      });
    }
  }

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

    const hands: HandFrame[] = [];
    const landmarkSets = result.landmarks ?? [];
    const handedness = result.handedness ?? [];

    for (let i = 0; i < landmarkSets.length; i++) {
      const raw = landmarkSets[i];
      const landmarks = raw.map(toVec2);
      const category = handedness[i]?.[0];
      hands.push({
        id: mapHandedness(category?.categoryName),
        timestampMs: ts,
        landmarks,
        wrist: landmarks[WRIST],
        palmCenter: palmCenter(landmarks),
        indexTip: landmarks[INDEX_TIP],
        confidence: category?.score ?? 0,
      });
    }

    return { timestampMs: ts, hands, inferenceMs };
  }

  dispose(): void {
    this.landmarker?.close();
    this.landmarker = null;
    this.lastVideoTimestamp = -1;
  }
}
