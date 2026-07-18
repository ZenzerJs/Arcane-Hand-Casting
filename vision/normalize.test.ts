import { describe, expect, it } from "vitest";
import { distance, normalizeLandmarks } from "./normalize";

describe("distance", () => {
  it("returns zero for identical points", () => {
    expect(distance({ x: 1, y: 2 }, { x: 1, y: 2 })).toBe(0);
  });

  it("computes Euclidean length", () => {
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });
});

describe("normalizeLandmarks", () => {
  it("centers on origin and scales by palm width", () => {
    const result = normalizeLandmarks(
      [
        { x: 2, y: 2 },
        { x: 4, y: 2 },
      ],
      { x: 2, y: 2 },
      2,
    );
    expect(result[0]).toEqual({ x: 0, y: 0 });
    expect(result[1]).toEqual({ x: 1, y: 0 });
  });
});
