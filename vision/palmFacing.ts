import type { HandId, PalmFacing, Vec3 } from "./types";

const WRIST = 0;
const INDEX_MCP = 5;
const PINKY_MCP = 17;

/** Below this |towardScore|, treat palm as edge-on. */
const SIDE_THRESHOLD = 0.12;

function cross(
  a: Vec3,
  b: Vec3,
): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

/**
 * Estimate whether the palm faces the camera.
 *
 * MediaPipe gives relative depth `z` (smaller = closer to camera).
 * Cross product of wrist→indexMCP and wrist→pinkyMCP yields a palm normal;
 * its camera-axis component becomes a toward/away score.
 *
 * This is a geometric proxy — good for Aegis debug, not a trained classifier.
 */
export function estimatePalmFacing(
  landmarks: Vec3[],
  handId: HandId,
): { facing: PalmFacing; towardScore: number } {
  const wrist = landmarks[WRIST];
  const index = landmarks[INDEX_MCP];
  const pinky = landmarks[PINKY_MCP];

  const v1: Vec3 = {
    x: index.x - wrist.x,
    y: index.y - wrist.y,
    z: index.z - wrist.z,
  };
  const v2: Vec3 = {
    x: pinky.x - wrist.x,
    y: pinky.y - wrist.y,
    z: pinky.z - wrist.z,
  };

  const normal = cross(v1, v2);
  const length = Math.hypot(normal.x, normal.y, normal.z) || 1e-6;
  const nz = normal.z / length;

  // Flip left hand so positive score ≈ palm toward camera for both hands.
  const towardScore = handId === "left" ? nz : -nz;

  if (towardScore > SIDE_THRESHOLD) {
    return { facing: "toward", towardScore };
  }
  if (towardScore < -SIDE_THRESHOLD) {
    return { facing: "away", towardScore };
  }
  return { facing: "side", towardScore };
}
