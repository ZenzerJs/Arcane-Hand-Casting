import { describe, expect, it } from "vitest";
import { coverViewport } from "./viewport";

describe("coverViewport", () => {
  it("falls back to an uncropped mapping before video size is known", () => {
    const vp = coverViewport(0, 0, 1600, 900);
    expect(vp.toScreen({ x: 0.5, y: 0.5 })).toEqual({ x: 800, y: 450 });
    expect(vp.toScreenMirrored({ x: 0, y: 0 })).toEqual({ x: 1600, y: 0 });
    expect(vp.xScale).toBe(1600);
  });

  it("is identity when the video and container share an aspect ratio", () => {
    const vp = coverViewport(1280, 720, 1280, 720);
    expect(vp.toScreen({ x: 0.25, y: 0.5 })).toEqual({ x: 320, y: 360 });
    expect(vp.toScreenMirrored({ x: 0.25, y: 0.5 })).toEqual({
      x: 960,
      y: 360,
    });
  });

  it("accounts for the vertical crop of a 4:3 video in a 16:9 box", () => {
    // 640x480 scaled by 2.5 -> 1600x1200, centered in 1600x900.
    // Top/bottom 150px are cropped, so source y=0.5 maps to screen y=450.
    const vp = coverViewport(640, 480, 1600, 900);
    expect(vp.xScale).toBe(1600);
    expect(vp.toScreen({ x: 0.5, y: 0.5 })).toEqual({ x: 800, y: 450 });
    // Source (0, 0) sits above the visible area (negative offset).
    expect(vp.toScreen({ x: 0, y: 0 })).toEqual({ x: 0, y: -150 });
    // Mirrored: source x=0 is the right edge of the mirrored frame.
    expect(vp.toScreenMirrored({ x: 0, y: 0 })).toEqual({ x: 1600, y: -150 });
  });

  it("accounts for the horizontal crop of a wide video in a narrow box", () => {
    // 1920x720 (2.66:1) in 1280x720: scale by height (720/720 = 1), so the
    // video stays 1920 wide and overflows the 1280px box — crop the sides.
    const vp = coverViewport(1920, 720, 1280, 720);
    expect(vp.xScale).toBe(1920);
    const left = vp.toScreen({ x: 0, y: 0.5 });
    expect(left.x).toBe((1280 - 1920) / 2);
    expect(left.y).toBe(360);
  });
});
