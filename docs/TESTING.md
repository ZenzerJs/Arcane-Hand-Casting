# Testing

## Automated

| Layer | Tool | What |
|---|---|---|
| Unit | Vitest | Geometry, smoothing, features, spell transitions, cooldowns |
| Integration | Vitest | Engine receives `cast` and spawns a projectile |
| E2E | Playwright | Landing, privacy copy, navigation, settings, restart (no real webcam) |

```bash
npm run test
npm run test:e2e
```

Webcam hardware behavior requires **manual** sessions. Do not treat green CI as proof that casting feels good.

## Manual device checklist

- [ ] Chrome/Edge desktop
- [ ] Bright vs dim indoor light
- [ ] Plain vs cluttered background
- [ ] Different hand sizes / left vs right dominance
- [ ] Hands close to / far from camera
- [ ] One hand drops mid-charge
- [ ] Tab switch / resize / camera revoked
- [ ] Fresh user silent test (tutorial)

## Device matrix (Stage 9)

Fill in per machine. The arena HUD shows a live `fps` chip (turns orange
below 30); the `/sandbox` debug overlay adds vision FPS and inference ms.

| Device | Browser | Render FPS | Vision FPS | Inference ms | Playable ≥30? | Notes |
|---|---|---|---|---|---|---|
| (e.g. laptop A) | Chrome | | | | | |
| (e.g. laptop B) | Edge | | | | | |

Perf notes:

- All Pixi canvases cap `resolution` at `devicePixelRatio ≤ 2`; on weak GPUs
  test with browser zoom 100% first.
- Vision loop is throttled to ~60 Hz and skips frames when inference lags —
  low vision FPS with fine render FPS points at MediaPipe, not Pixi.
- If render FPS is low only during Storm Weave, lower `BlurFilter` strength
  in `LightningRenderer` before touching anything else.

## Trial mode gate (Stage 8)

- [ ] Wave 1 clears with each spell type individually
- [ ] Aegis blocks a hazard reliably 8/10 raises
- [ ] Losing all 3 lives shows end screen with score + retry
- [ ] 5–10 minute session with no freeze or ghost visuals

## Metrics to log

| Metric | Target |
|---|---|
| Render FPS | 50–60 ideal; playable at 30 |
| Vision update rate | Responsive spell tracking |
| First-cast time | Under ~60s after onboarding |
| Intentional cast success | 80%+ ordinary conditions |
| Accidental casts | Low enough players trust controls |

## Ember Orb gate (Stage 5)

Each collaborator: **8/10** intentional casts; **≤1** accidental cast in 2 minutes free play.
