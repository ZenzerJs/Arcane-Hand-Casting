/**
 * CameraManager — requests getUserMedia, exposes status, stops tracks on leave.
 */

export type CameraStatus =
  | "idle"
  | "requesting"
  | "ready"
  | "denied"
  | "unsupported"
  | "stopped"
  | "error";

export class CameraManager {
  status: CameraStatus = "idle";
  stream: MediaStream | null = null;
  errorMessage: string | null = null;

  async start(constraints?: MediaTrackConstraints): Promise<MediaStream> {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.status = "unsupported";
      this.errorMessage = "Camera API not available in this browser.";
      throw new Error(this.errorMessage);
    }

    this.status = "requesting";
    this.errorMessage = null;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
          ...constraints,
        },
        audio: false,
      });
      this.stream = stream;
      this.status = "ready";
      return stream;
    } catch (err) {
      const name = err instanceof DOMException ? err.name : "Error";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        this.status = "denied";
        this.errorMessage = "Camera permission denied.";
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        this.status = "unsupported";
        this.errorMessage = "No camera found.";
      } else {
        this.status = "error";
        this.errorMessage = err instanceof Error ? err.message : "Failed to open camera.";
      }
      throw err;
    }
  }

  stop(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.status = "stopped";
  }
}
