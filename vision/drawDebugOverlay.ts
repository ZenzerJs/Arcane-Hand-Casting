import { HAND_CONNECTIONS } from "./handConnections";
import { distance } from "./normalize";
import type { HandFrame, VisionFrame } from "./types";

export type DebugMetrics = {
  renderFps: number;
  visionFps: number;
  inferenceMs: number;
  palmDistance: number | null;
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
    drawHand(ctx, hand, width, height);
  }

  drawHud(ctx, frame, metrics);
}

function toScreen(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: (1 - x) * width,
    y: y * height,
  };
}

function drawHand(
  ctx: CanvasRenderingContext2D,
  hand: HandFrame,
  width: number,
  height: number,
): void {
  const color = hand.id === "left" ? "#3de0d0" : hand.id === "right" ? "#ff7a3a" : "#8b6cff";

  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [a, b] of HAND_CONNECTIONS) {
    const pa = toScreen(hand.landmarks[a].x, hand.landmarks[a].y, width, height);
    const pb = toScreen(hand.landmarks[b].x, hand.landmarks[b].y, width, height);
    ctx.moveTo(pa.x, pa.y);
    ctx.lineTo(pb.x, pb.y);
  }
  ctx.stroke();

  for (const point of hand.landmarks) {
    const p = toScreen(point.x, point.y, width, height);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }

  const palm = toScreen(hand.palmCenter.x, hand.palmCenter.y, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(palm.x, palm.y, 5, 0, Math.PI * 2);
  ctx.fill();

  // Index direction ray (PIP 6 → tip 8)
  const pip = toScreen(hand.landmarks[6].x, hand.landmarks[6].y, width, height);
  const tip = toScreen(hand.indexTip.x, hand.indexTip.y, width, height);
  const dx = tip.x - pip.x;
  const dy = tip.y - pip.y;
  ctx.strokeStyle = "#e8eefc";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(tip.x, tip.y);
  ctx.lineTo(tip.x + dx * 1.4, tip.y + dy * 1.4);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "12px monospace";
  ctx.fillText(`${hand.id} ${(hand.confidence * 100).toFixed(0)}%`, palm.x + 8, palm.y - 8);
}

function drawHud(
  ctx: CanvasRenderingContext2D,
  frame: VisionFrame,
  metrics: DebugMetrics,
): void {
  const lines = [
    `hands: ${frame.hands.length}`,
    `render: ${metrics.renderFps.toFixed(0)} fps`,
    `vision: ${metrics.visionFps.toFixed(0)} fps`,
    `infer: ${metrics.inferenceMs.toFixed(1)} ms`,
    `palmDist: ${
      metrics.palmDistance === null ? "—" : metrics.palmDistance.toFixed(3)
    }`,
  ];

  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(8, 8, 168, 18 + lines.length * 16);
  ctx.fillStyle = "#e8eefc";
  ctx.font = "12px monospace";
  lines.forEach((line, i) => {
    ctx.fillText(line, 16, 28 + i * 16);
  });
}

export function computePalmDistance(hands: HandFrame[]): number | null {
  if (hands.length < 2) return null;
  return distance(hands[0].palmCenter, hands[1].palmCenter);
}
