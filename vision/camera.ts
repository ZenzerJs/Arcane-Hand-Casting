/**
 * CameraManager — Stage 2.
 * Requests getUserMedia, exposes loading/denied/unsupported states, stops tracks on leave.
 */

export type CameraStatus = "idle" | "requesting" | "ready" | "denied" | "unsupported" | "stopped";

export class CameraManager {
  status: CameraStatus = "idle";
  stream: MediaStream | null = null;

  async start(): Promise<MediaStream> {
    throw new Error("CameraManager.start not implemented — Stage 2");
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.status = "stopped";
  }
}
