import { HAND_CONNECTIONS } from "./handConnections";
import type { HandFeatures } from "./features";
import type { TrackingQuality } from "./quality";
import type { HandFrame, VisionFrame } from "./types";
import { coverViewport } from "./viewport";

export type DebugMetrics = {
  renderFps: number;
  visionFps: number;
  inferenceMs: number;
  /** Intrinsic video size, used to undo the `object-cover` crop. */
  videoWidth: number;
  videoHeight: number;
  /** Stage 3 engineered features (palm dist, openness, …). */
  features: HandFeatures | null;
  /** User-facing result of Stage 3 quality gates. */
  quality: TrackingQuality;
};

/**
 * Draw mirrored landmark overlay in canvas pixel space.
 * Landmarks are MediaPipe normalized (0..1); x is mirrored to match selfie view.
 */
export function drawDebugOverlay(
  ctx: CanvasRenderingContext2D,
  frame: VisionFrame,
  metrics: DebugMetrics,
): void {
  const { width, height } = ctx.canvas;
  ctx.clearRect(0, 0, width, height);

  for (const hand of frame.hands) {
    drawHand(ctx, hand, width, height, metrics.videoWidth, metrics.videoHeight);
  }

  drawHud(ctx, frame, metrics);
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  hand: HandFrame,
  width: number,
  height: number,
  videoWidth: number,
  videoHeight: number,
): void {
  const color = hand.id === "left" ? "#3de0d0" : hand.id === "right" ? "#ff7a3a" : "#8b6cff";
  const vp = coverViewport(videoWidth, videoHeight, width, height);

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = vp.toScreenMirrored({ x: hand.landmarks[a].x, y: hand.landmarks[a].y });
    const pb = vp.toScreenMirrored({ x: hand.landmarks[b].x, y: hand.landmarks[b].y });
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();

  for (const point of hand.landmarks) {
    const p = vp.toScreenMirrored({ x: point.x, y: point.y });
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const palm = vp.toScreenMirrored({ x: hand.palmCenter.x, y: hand.palmCenter.y });
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(palm.x, palm.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.font = "12px monospace";
  ctx.fillText(
    `${hand.id} ${(hand.confidence * 100).toFixed(0)}% ${hand.palmFacing}`,
    palm.x + 8,
    palm.y - 8,
  );

  // Short normal tick: toward = into scene (up on label), away = opposite feel.
  const facingColor =
    hand.palmFacing === "toward"
      ? "#7dff9a"
      : hand.palmFacing === "away"
        ? "#ff6b6b"
        : "#ffd36b";
  ctx.strokeStyle = facingColor;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(palm.x, palm.y);
  ctx.lineTo(palm.x, palm.y + (hand.palmFacing === "toward" ? -18 : hand.palmFacing === "away" ? 18 : 0));
  if (hand.palmFacing === "side") {
    ctx.moveTo(palm.x - 10, palm.y);
    ctx.lineTo(palm.x + 10, palm.y);
  }
  ctx.stroke();
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  frame: VisionFrame,
  metrics: DebugMetrics,
): void {
  const facing =
    frame.hands.length === 0
      ? "—"
      : frame.hands.map((h) => `${h.id[0]}:${h.palmFacing}`).join(" ");

  const features = metrics.features;
  const openness =
    !features || features.hands.length === 0
      ? "—"
      : features.hands.map((h) => `${h.id[0]}:${h.openness.toFixed(2)}`).join(" ");
  const motion =
    !features || features.hands.length === 0
      ? "—"
      : features.hands
          .map(
            (hand) =>
              `${hand.id[0]}:v${hand.speed.toFixed(1)}` +
              `/f${hand.forwardVelocity.toFixed(1)}`,
          )
          .join(" ");
  const stability =
    !features || features.hands.length === 0
      ? "—"
      : features.hands
          .map((hand) =>
            `${hand.id[0]}:${
              hand.stability === null ? "—" : hand.stability.toFixed(2)
            }`,
          )
          .join(" ");

  const lines = [
    `quality: ${metrics.quality}`,
    `hands: ${frame.hands.length}`,
    `facing: ${facing}`,
    `open: ${openness}`,
    `motion: ${motion}`,
    `stable: ${stability}`,
    `render: ${metrics.renderFps.toFixed(0)} fps`,
    `vision: ${metrics.visionFps.toFixed(0)} fps`,
    `infer: ${metrics.inferenceMs.toFixed(1)} ms`,
    `palmDist: ${
      features?.palmDistance == null ? "—" : features.palmDistance.toFixed(3)
    }`,
  ];

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(8, 8, 250, 18 + lines.length * 16);
  ctx.fillStyle = "#e8eefc";
  ctx.font = "12px monospace";
  lines.forEach((line, i) => {
    ctx.fillText(line, 16, 28 + i * 16);
  });
}
