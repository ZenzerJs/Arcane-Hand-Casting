/**
 * Geometric / temporal hand features — Stage 3.
 * Palm distance, openness, velocity, stability, etc.
 */

export type HandFeatures = {
  handCount: number;
  palmDistance: number | null;
  // Extended in Stage 3.
};

export function extractFeatures(): HandFeatures {
  return { handCount: 0, palmDistance: null };
}
