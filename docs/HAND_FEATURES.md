# Hand features

Landmarks → engineered signals used by spell state machines.

## Coordinate spaces

1. **Camera** — MediaPipe normalized image coords (~0..1)
2. **Normalized hand** — translated about wrist/palm, scaled by palm width
3. **Arena** — PixiJS / Matter.js world pixels

Mirror camera input so the player’s screen-right hand matches expectation.

## Features

| Feature | Method | Used by |
|---|---|---|
| Hand count | Valid tracked hands | Ember readiness, UI |
| Palm center | Mean of wrist + MCP joints | Effect anchor |
| Palm width | Index–pinky MCP distance | Normalization |
| Palm distance | Distance between palm centers | Ember charge |
| Hand velocity | Smoothed delta over history | Cast release |
| Finger extension | Tip vs PIP/MCP geometry | Open palm / fist / point |
| Pinch strength | Thumb–index / palm width | Gale (later) |
| Index ray | Index PIP → tip | Storm Thread (later) |
| Palm facing proxy | Wrist/MCP or 3D if reliable | Aegis orientation |
| Pose stability | Low variance over hold window | Charge readiness |
| Tracking quality | Confidence, age, bounds | Cancel + feedback |

## Quality states

`GOOD` · `NO_HANDS` · `NEED_TWO_HANDS` · `HANDS_TOO_CLOSE_TO_CAMERA` · `HANDS_OUT_OF_FRAME` · `LOW_CONFIDENCE` · `GESTURE_UNSTABLE`

See `vision/quality.ts` for user-facing copy.

## Smoothing

```text
smoothed_t = alpha * raw_t + (1 - alpha) * smoothed_(t-1)
```

Initial `alpha` ~0.45–0.7. Keep raw and smoothed separate for debugging.
