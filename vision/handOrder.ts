import type { HandFrame } from "./types";

const ORDER: Record<HandFrame["id"], number> = {
  left: 0,
  right: 1,
  unknown: 2,
};

/**
 * MediaPipe does not guarantee a stable hand order across frames — the same
 * physical hand can appear at index 0 on one frame and index 1 on the next.
 * Sorting by handedness keeps spell pairing (lightning arcs, palm pairs, the
 * single-hand Aegis) anchored to the same hand, so effects stop flipping sides
 * mid-gesture.
 */
export function sortHands(hands: HandFrame[]): HandFrame[] {
  if (hands.length < 2) return hands;
  return [...hands].sort((a, b) => ORDER[a.id] - ORDER[b.id]);
}
