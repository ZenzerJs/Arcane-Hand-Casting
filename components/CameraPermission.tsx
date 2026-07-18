"use client";

import type { CameraStatus } from "@/vision/camera";

type Props = {
  status: CameraStatus;
  errorMessage: string | null;
  onEnable: () => void;
};

export function CameraPermission({ status, errorMessage, onEnable }: Props) {
  if (status === "ready") return null;

  const busy = status === "requesting";

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/70 p-6 text-center">
      <div className="max-w-sm space-y-4">
        <h2 className="text-xl font-semibold text-foreground">Enable camera</h2>
        <p className="text-sm text-foreground/70">
          Hand tracking runs locally in your browser. Video is not uploaded or stored.
        </p>

        {status === "denied" && (
          <p className="text-sm text-ember">
            {errorMessage ?? "Camera permission denied."} Allow camera access in the browser,
            then try again.
          </p>
        )}
        {status === "unsupported" && (
          <p className="text-sm text-ember">{errorMessage ?? "No usable camera found."}</p>
        )}
        {status === "error" && (
          <p className="text-sm text-ember">{errorMessage ?? "Camera failed to start."}</p>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={onEnable}
          className="rounded-md bg-ember px-5 py-3 text-sm font-medium text-black transition hover:brightness-110 disabled:opacity-50"
        >
          {busy ? "Requesting…" : "Enable Camera"}
        </button>
      </div>
    </div>
  );
}
