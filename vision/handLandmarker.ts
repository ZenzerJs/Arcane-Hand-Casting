/**
 * MediaPipe Hand Landmarker wrapper — Stage 2.
 * Loads the model from /public/models and runs controlled-rate video inference.
 */

import type { VisionFrame } from "./types";

export class HandLandmarkerService {
  async initialize(): Promise<void> {
    throw new Error("HandLandmarkerService.initialize not implemented — Stage 2");
  }

  async detect(_video: HTMLVideoElement, _timestampMs: number): Promise<VisionFrame> {
    throw new Error("HandLandmarkerService.detect not implemented — Stage 2");
  }

  dispose(): void {
    // no-op until Stage 2
  }
}
