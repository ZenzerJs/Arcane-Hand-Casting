/**
 * Gesture sign matching — nearest-neighbour over example datasets.
 *
 * Instead of hard `openness <= X` / `openness >= Y` thresholds, each hand is
 * reduced to a feature vector (five per-finger extensions + palm facing) and
 * compared against a dataset of representative examples for each sign. The
 * nearest example's similarity must clear a threshold, so a hand does not
 * have to match an expected value exactly — it only has to be "close enough".
 *
 * Every sign ships with 20+ seed examples spanning the natural variance of the
 * pose (tightness of a fist, how squarely a palm faces the camera, the angle
 * of a gun hand). Classification asks "is the hand close to any of these?".
 *
 * The dataset grows on its own: while a hand is actively casting a sign, its
 * live vector is merged into that sign's dataset (see `learnFromLiveVector`)
 * and persisted to localStorage so the classifier learns the player's own
 * hand across sessions. Only numeric values are stored — the sign vector plus
 * the palm position — never image or video frames.
 *
 * This is deliberately small and pure so Vitest can drive synthetic hands.
 */

import type { HandFeatures, PerHandFeatures } from "@/vision/features";
import type { Vec2 } from "@/vision/types";

export const HAND_SIGNS = ["ember", "aegis", "gun", "lightning"] as const;
export type HandSign = (typeof HAND_SIGNS)[number];

/** Feature vector distilled from one hand for sign matching. */
export type HandSignVector = {
  /** Per-finger extension (0..1), thumb → index → middle → ring → pinky. */
  fingers: number[];
  /** Palm facing as a scalar: 1 = toward camera, 0 = away, 0.5 = side. */
  facing: number;
};

/** Gaussian similarity width — smaller sigma means stricter matching. */
const SIGMA = 0.18;

/** Minimum similarity to the nearest example before a sign is declared. */
export const SIGN_MATCH_THRESHOLD = 0.75;

/** Short helper so the seed datasets below read as compact vectors. */
function example(fingers: number[], facing: number): HandSignVector {
  return { fingers, facing };
}

/**
 * Seed example vectors per sign. Real hands rarely match one example exactly,
 * so each dataset spans the natural variance of the pose. Recorded samples
 * (and auto-learned live frames) extend these lists at runtime via
 * `examplesFor`.
 */
export const SIGN_DATASETS: Record<HandSign, HandSignVector[]> = {
  // Closed fist — all fingers curled. Thumb may sit tucked or slightly out,
  // and a fist can face the camera, away, or edge-on.
  ember: [
    example([0.05, 0.05, 0.05, 0.05, 0.05], 0),
    example([0.05, 0.05, 0.05, 0.05, 0.05], 0.5),
    example([0.05, 0.05, 0.05, 0.05, 0.05], 1),
    example([0.1, 0.05, 0.05, 0.05, 0.05], 0),
    example([0.1, 0.05, 0.05, 0.05, 0.05], 0.5),
    example([0.1, 0.05, 0.05, 0.05, 0.05], 1),
    example([0.2, 0.1, 0.1, 0.1, 0.1], 0),
    example([0.2, 0.1, 0.1, 0.1, 0.1], 0.5),
    example([0.2, 0.1, 0.1, 0.1, 0.1], 1),
    example([0.3, 0.15, 0.15, 0.15, 0.15], 0.5),
    example([0.3, 0.15, 0.15, 0.15, 0.15], 1),
    example([0.1, 0.1, 0.1, 0.1, 0.1], 0),
    example([0.1, 0.1, 0.1, 0.1, 0.1], 0.5),
    example([0.15, 0.1, 0.1, 0.1, 0.1], 1),
    example([0.25, 0.2, 0.2, 0.2, 0.2], 0.5),
    example([0.25, 0.2, 0.2, 0.2, 0.2], 1),
    example([0.35, 0.25, 0.25, 0.25, 0.25], 1),
    example([0.05, 0.1, 0.1, 0.1, 0.1], 0.5),
    example([0.2, 0.15, 0.15, 0.15, 0.2], 0.5),
    example([0.15, 0.2, 0.2, 0.2, 0.25], 1),
    example([0.3, 0.25, 0.25, 0.25, 0.3], 1),
    example([0.2, 0.05, 0.05, 0.05, 0.05], 0.5),
    example([0.15, 0.15, 0.15, 0.15, 0.15], 0),
    example([0.2, 0.2, 0.2, 0.2, 0.2], 0.5),
  ],
  // Open palm toward the camera — four fingers extended, thumb relaxed.
  aegis: [
    example([0.7, 0.75, 0.75, 0.75, 0.75], 1),
    example([0.75, 0.8, 0.8, 0.8, 0.8], 1),
    example([0.8, 0.85, 0.85, 0.85, 0.85], 1),
    example([0.85, 0.9, 0.9, 0.9, 0.9], 1),
    example([0.9, 0.95, 0.95, 0.95, 0.95], 1),
    example([0.95, 1, 1, 1, 1], 1),
    example([1, 1, 1, 1, 1], 1),
    example([0.85, 0.9, 0.9, 0.85, 0.8], 1),
    example([0.7, 0.8, 0.85, 0.85, 0.8], 1),
    example([0.75, 0.85, 0.9, 0.85, 0.75], 1),
    example([0.6, 0.75, 0.8, 0.8, 0.75], 1),
    example([0.8, 0.85, 0.9, 0.9, 0.85], 1),
    example([0.9, 0.95, 1, 0.95, 0.9], 1),
    example([0.7, 0.7, 0.7, 0.7, 0.7], 1),
    example([0.8, 0.8, 0.8, 0.8, 0.8], 1),
    example([0.9, 0.9, 0.9, 0.9, 0.9], 1),
    example([0.65, 0.75, 0.8, 0.8, 0.7], 1),
    example([0.75, 0.8, 0.85, 0.85, 0.8], 1),
    example([0.85, 0.9, 0.95, 0.9, 0.85], 1),
    example([0.7, 0.75, 0.8, 0.75, 0.7], 1),
  ],
  // Gun hand — index extended to point, thumb cocked up, other three curled.
  gun: [
    example([0.6, 0.9, 0.1, 0.1, 0.1], 0.5),
    example([0.6, 0.9, 0.1, 0.1, 0.1], 1),
    example([0.7, 0.95, 0.1, 0.1, 0.1], 0.5),
    example([0.7, 0.95, 0.1, 0.1, 0.1], 1),
    example([0.8, 1, 0.1, 0.1, 0.1], 0.5),
    example([0.8, 1, 0.1, 0.1, 0.1], 1),
    example([0.5, 0.85, 0.15, 0.15, 0.15], 0.5),
    example([0.5, 0.85, 0.15, 0.15, 0.15], 1),
    example([0.9, 0.9, 0.05, 0.05, 0.05], 0.5),
    example([0.9, 0.9, 0.05, 0.05, 0.05], 1),
    example([0.7, 0.9, 0.2, 0.2, 0.2], 0.5),
    example([0.7, 0.9, 0.2, 0.2, 0.2], 1),
    example([0.6, 0.95, 0.25, 0.25, 0.25], 0.5),
    example([0.6, 0.95, 0.25, 0.25, 0.25], 1),
    example([0.8, 0.85, 0.1, 0.15, 0.15], 0.5),
    example([0.8, 0.85, 0.1, 0.15, 0.15], 1),
    example([0.5, 0.8, 0.2, 0.25, 0.25], 0.5),
    example([0.65, 0.9, 0.15, 0.2, 0.2], 1),
    example([0.75, 0.95, 0.1, 0.15, 0.1], 0.5),
    example([0.7, 1, 0.05, 0.1, 0.05], 1),
    example([0.55, 0.85, 0.2, 0.2, 0.2], 0),
    example([0.6, 0.9, 0.15, 0.15, 0.15], 0),
  ],
  // Lightning hand — palm edge-on (facing the other hand) with fingers
  // spread. Two of these side by side cast Storm Weave.
  lightning: [
    example([0.75, 0.8, 0.8, 0.8, 0.8], 0.5),
    example([0.8, 0.85, 0.85, 0.85, 0.85], 0.5),
    example([0.85, 0.9, 0.9, 0.9, 0.9], 0.5),
    example([0.9, 0.95, 0.95, 0.95, 0.95], 0.5),
    example([0.95, 1, 1, 1, 1], 0.5),
    example([0.7, 0.8, 0.85, 0.85, 0.8], 0.5),
    example([0.8, 0.85, 0.9, 0.9, 0.85], 0.5),
    example([0.75, 0.8, 0.85, 0.85, 0.75], 0.5),
    example([0.85, 0.9, 0.95, 0.9, 0.85], 0.5),
    example([0.7, 0.75, 0.8, 0.75, 0.7], 0.5),
    example([0.9, 0.9, 0.9, 0.9, 0.9], 0.5),
    example([0.8, 0.8, 0.8, 0.8, 0.8], 0.5),
    example([0.65, 0.75, 0.8, 0.8, 0.7], 0.5),
    example([0.85, 0.85, 0.9, 0.85, 0.85], 0.5),
    example([0.75, 0.85, 0.9, 0.85, 0.8], 0.5),
    example([0.8, 0.9, 0.95, 0.9, 0.85], 0.5),
    example([0.7, 0.8, 0.8, 0.8, 0.75], 0.5),
    example([0.9, 0.95, 1, 0.95, 0.9], 0.5),
    example([0.75, 0.75, 0.8, 0.75, 0.75], 0.5),
    example([0.85, 0.9, 0.9, 0.85, 0.8], 0.5),
  ],
};

/** Palm-facing category as a scalar so it can live in the same vector. */
export function facingScalar(
  facing: PerHandFeatures["palmFacing"],
): number {
  switch (facing) {
    case "toward":
      return 1;
    case "away":
      return 0;
    default:
      return 0.5; // side
  }
}

/** Build the matchable vector from engineered per-hand features. */
export function handSignVector(hand: PerHandFeatures): HandSignVector {
  return {
    fingers: [...hand.fingerExtensions],
    facing: facingScalar(hand.palmFacing),
  };
}

/**
 * Similarity (0..1) between a hand vector and a sign's example dataset.
 * Gaussian over root-mean-square distance across dimensions: identical = 1,
 * far apart → 0. RMS keeps the score scale stable regardless of vector size.
 */
export function signSimilarity(
  vector: HandSignVector,
  examples: HandSignVector[],
): number {
  let best = 0;
  for (const example of examples) {
    const d = vectorDistance(vector, example);
    const similarity = Math.exp(-(d * d) / (2 * SIGMA * SIGMA));
    best = Math.max(best, similarity);
  }
  return best;
}

/** Similarity to every sign's dataset — feeds the live score tracker. */
export function signScores(vector: HandSignVector): Record<HandSign, number> {
  const scores = {} as Record<HandSign, number>;
  for (const sign of HAND_SIGNS) {
    scores[sign] = signSimilarity(vector, examplesFor(sign));
  }
  return scores;
}

/**
 * Compact per-hand score readout for the live tracker:
 * `"right:aegis e0.01 a0.98 g0.02 · left:ember e0.96 a0.03 g0.01"`.
 * Empty when no hands.
 */
export function handScoresLabel(features: HandFeatures): string {
  if (features.hands.length === 0) return "";
  return features.hands
    .map((hand) => {
      const vector = handSignVector(hand);
      const scores = signScores(vector);
      const sign = classifyHandSign(vector);
      return `${hand.id}${sign ? ":" + sign : ""} e${scores.ember.toFixed(2)} a${scores.aegis.toFixed(2)} g${scores.gun.toFixed(2)} l${scores.lightning.toFixed(2)}`;
    })
    .join(" · ");
}

/** Root-mean-square distance across finger + facing dimensions. */
function vectorDistance(a: HandSignVector, b: HandSignVector): number {
  const dims = Math.min(a.fingers.length, b.fingers.length) + 1;
  let sumSq = 0;
  for (let i = 0; i < Math.min(a.fingers.length, b.fingers.length); i++) {
    const d = a.fingers[i] - b.fingers[i];
    sumSq += d * d;
  }
  const df = a.facing - b.facing;
  sumSq += df * df;
  return Math.sqrt(sumSq / Math.max(1, dims));
}

/** Best-matching sign, or null when no example is close enough. */
export function classifyHandSign(vector: HandSignVector): HandSign | null {
  let bestSign: HandSign | null = null;
  let bestScore = SIGN_MATCH_THRESHOLD;
  for (const sign of HAND_SIGNS) {
    const score = signSimilarity(vector, examplesFor(sign));
    if (score > bestScore) {
      bestScore = score;
      bestSign = sign;
    }
  }
  return bestSign;
}

/* ------------------------------ Recording ------------------------------ */

const STORAGE_KEY = "arcane.signSamples.v2";

/** A captured hand sample: numeric values + position, never image frames. */
export type RecordedSample = {
  /** The sign values (per-finger extension + facing) used for matching. */
  vector: HandSignVector;
  /** Palm center (camera-normalized 0..1) at capture — reference only. */
  palm: Vec2;
};

function emptyStore(): Record<HandSign, RecordedSample[]> {
  return { ember: [], aegis: [], gun: [], lightning: [] };
}

let recordedSamples: Record<HandSign, RecordedSample[]> = emptyStore();

/** Server-safe counts (no localStorage during SSR). */
export const EMPTY_SAMPLE_COUNTS: Record<HandSign, number> = {
  ember: 0,
  aegis: 0,
  gun: 0,
  lightning: 0,
};

/** React-friendly snapshot of the sample counts — stable reference. */
let sampleCountSnapshot: Record<HandSign, number> = EMPTY_SAMPLE_COUNTS;
const sampleCountListeners = new Set<() => void>();

/** Recompute the snapshot and notify subscribers (called on every mutation). */
function publishSampleCounts(): void {
  sampleCountSnapshot = recordedSampleCounts();
  for (const listener of sampleCountListeners) listener();
}

/** Subscribe to sample-store changes for `useSyncExternalStore`. */
export function subscribeSampleCounts(listener: () => void): () => void {
  sampleCountListeners.add(listener);
  return () => {
    sampleCountListeners.delete(listener);
  };
}

/** Stable per-sign count snapshot for `useSyncExternalStore`. */
export function getSampleCounts(): Record<HandSign, number> {
  return sampleCountSnapshot;
}

/**
 * Record a live hand sample under a sign so it joins that sign's dataset.
 * Only `vector` (values) and `palm` (position) are stored — nothing else.
 */
export function recordSignSample(
  sign: HandSign,
  vector: HandSignVector,
  palm: Vec2,
): void {
  recordedSamples[sign].push({ vector: cloneVector(vector), palm: { ...palm } });
  saveRecordedSamples();
  publishSampleCounts();
}

/** How many samples have been recorded for each sign. */
export function recordedSampleCounts(): Record<HandSign, number> {
  const counts = {} as Record<HandSign, number>;
  for (const sign of HAND_SIGNS) counts[sign] = recordedSamples[sign].length;
  return counts;
}

/** A copy of the recorded samples for a sign (used by export/tests). */
export function getRecordedSamples(sign: HandSign): RecordedSample[] {
  return recordedSamples[sign].map(cloneSample);
}

/** Drop every recorded sample (seed datasets stay put). */
export function clearRecordedSamples(): void {
  recordedSamples = emptyStore();
  for (const sign of HAND_SIGNS) lastAutoLearnAt[sign] = 0;
  saveRecordedSamples();
  publishSampleCounts();
}

/** Serialize recorded samples as JSON — for export/sharing/review. */
export function exportRecordedSamples(): string {
  return JSON.stringify(recordedSamples, null, 2);
}

/**
 * Replace the recorded sample store from exported JSON.
 * Returns the new per-sign counts, or null when the JSON is invalid.
 */
export function importRecordedSamples(
  json: string,
): Record<HandSign, number> | null {
  try {
    const parsed: unknown = JSON.parse(json);
    const store = normalizeSampleStore(parsed);
    if (!store) return null;
    recordedSamples = store;
    saveRecordedSamples();
    publishSampleCounts();
    return recordedSampleCounts();
  } catch {
    return null;
  }
}

/* --------------------------- Continuous learning ------------------------ */

/** Min similarity before a live frame auto-joins a sign's dataset. */
const LEARN_CONFIDENCE = 0.78;
/** Skip when the frame is already nearly identical to a known example. */
const LEARN_DUPLICATE = 0.997;
/** Min ms between auto-captures per sign (throttle the pool growth). */
const LEARN_INTERVAL_MS = 400;
/** Cap per-sign learned pool so localStorage stays bounded. */
const MAX_POOL_PER_SIGN = 250;

const lastAutoLearnAt: Record<HandSign, number> = {
  ember: 0,
  aegis: 0,
  gun: 0,
  lightning: 0,
};

/**
 * Merge a live hand vector into a sign's dataset while that hand is actively
 * casting it. Guards against noise: only confident matches, throttled, and
 * only when the vector is genuinely new (fills a gap the dataset doesn't
 * already cover). Returns true when a sample was actually added.
 */
export function learnFromLiveVector(
  sign: HandSign,
  vector: HandSignVector,
  palm: Vec2,
  now = Date.now(),
): boolean {
  const score = signSimilarity(vector, examplesFor(sign));
  if (score < LEARN_CONFIDENCE) return false;
  if (score > LEARN_DUPLICATE) return false;
  if (now - lastAutoLearnAt[sign] < LEARN_INTERVAL_MS) return false;

  recordedSamples[sign].push({ vector: cloneVector(vector), palm: { ...palm } });
  if (recordedSamples[sign].length > MAX_POOL_PER_SIGN) {
    recordedSamples[sign].shift();
  }
  lastAutoLearnAt[sign] = now;
  saveRecordedSamples();
  publishSampleCounts();
  return true;
}

/* ------------------------------ Helpers -------------------------------- */

function cloneVector(vector: HandSignVector): HandSignVector {
  return { fingers: [...vector.fingers], facing: vector.facing };
}

function cloneSample(sample: RecordedSample): RecordedSample {
  return { vector: cloneVector(sample.vector), palm: { ...sample.palm } };
}

/** Seed examples plus any recorded samples for a sign. */
function examplesFor(sign: HandSign): HandSignVector[] {
  return [
    ...SIGN_DATASETS[sign],
    ...recordedSamples[sign].map((sample) => sample.vector),
  ];
}

function saveRecordedSamples(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(recordedSamples));
  } catch {
    // Storage can be unavailable (private mode, quota) — matching still works.
  }
}

/** Load persisted samples on module init (browser only). */
function loadRecordedSamples(): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    const store = normalizeSampleStore(parsed);
    if (!store) return;
    recordedSamples = store;
    publishSampleCounts();
  } catch {
    // Corrupt/blocked storage should never break matching.
  }
}

/**
 * Validate a (possibly partial) sample store and fill missing signs with
 * empty lists — so stores persisted by older versions (without `gun`) still
 * load cleanly.
 */
function normalizeSampleStore(
  value: unknown,
): Record<HandSign, RecordedSample[]> | null {
  if (typeof value !== "object" || value === null) return null;
  const store = value as Record<string, unknown>;
  const result = {} as Record<HandSign, RecordedSample[]>;
  for (const sign of HAND_SIGNS) {
    const raw = store[sign];
    if (raw === undefined || raw === null) {
      result[sign] = [];
    } else if (Array.isArray(raw) && raw.every(isRecordedSample)) {
      result[sign] = raw.map(cloneSample);
    } else {
      return null;
    }
  }
  return result;
}

function isRecordedSample(value: unknown): value is RecordedSample {
  if (typeof value !== "object" || value === null) return false;
  const sample = value as Record<string, unknown>;
  return (
    isSignVector(sample.vector) &&
    typeof sample.palm === "object" &&
    sample.palm !== null &&
    typeof (sample.palm as Record<string, unknown>).x === "number" &&
    typeof (sample.palm as Record<string, unknown>).y === "number"
  );
}

function isSignVector(value: unknown): value is HandSignVector {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    Array.isArray(v.fingers) &&
    v.fingers.every((n) => typeof n === "number") &&
    typeof v.facing === "number"
  );
}

loadRecordedSamples();
