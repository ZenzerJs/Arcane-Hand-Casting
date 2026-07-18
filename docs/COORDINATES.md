# Coordinate spaces

## 1. Camera (MediaPipe)

Normalized image coords, roughly `x,y ∈ [0, 1]`. Origin top-left of the camera frame (not mirrored).

## 2. Normalized hand

Landmarks translated about wrist/palm and scaled by palm width. Used for pose comparison across people/cameras. Stage 3.

## 3. Arena / screen

PixiJS / Matter.js world pixels, or canvas CSS pixels for debug overlay.

## Mirroring

Selfie cameras feel wrong without a horizontal flip. Pipeline:

1. `<video>` CSS `scale-x(-1)` so the live feed matches a mirror.
2. Overlay maps landmark `x` with `(1 - x) * width` so bones sit on the mirrored hands.

Moving a physical hand right should move the rune/skeleton right on screen.
