import type { Vec2 } from "./types";

export type Viewport = {
  /** Pixels per normalized-x unit (screen width of the full video frame). */
  xScale: number;
  /** Map a normalized (0..1) video coordinate to container pixels. */
  toScreen: (p: Vec2) => Vec2;
  /** Same as `toScreen`, but mirrors x for the selfie view. */
  toScreenMirrored: (p: Vec2) => Vec2;
};

/**
 * Reconciles MediaPipe's normalized (0..1) video coordinates with a CSS
 * `object-fit: cover` box.
 *
 * Without this, overlays misalign whenever the camera's aspect ratio differs
 * from the display box (e.g. a 4:3 camera shown in a 16:9 frame): `cover`
 * crops the video before drawing, so a straight `x * width` mapping drifts
 * further from the hand the closer it gets to a cropped edge.
 */
export function coverViewport(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
): Viewport {
  const hasVideo = videoWidth > 0 && videoHeight > 0;

  // Before dimensions are known, fall back to an uncropped 1:1 mapping.
  if (!hasVideo) {
    return {
      xScale: containerWidth,
      toScreen: (p) => ({ x: p.x * containerWidth, y: p.y * containerHeight }),
      toScreenMirrored: (p) => ({
        x: (1 - p.x) * containerWidth,
        y: p.y * containerHeight,
      }),
    };
  }

  const scale = Math.max(
    containerWidth / videoWidth,
    containerHeight / videoHeight,
  );
  const offsetX = (containerWidth - videoWidth * scale) / 2;
  const offsetY = (containerHeight - videoHeight * scale) / 2;

  const map = (x: number, y: number): Vec2 => ({
    x: x * videoWidth * scale + offsetX,
    y: y * videoHeight * scale + offsetY,
  });

  return {
    xScale: videoWidth * scale,
    toScreen: (p) => map(p.x, p.y),
    toScreenMirrored: (p) => map(1 - p.x, p.y),
  };
}
