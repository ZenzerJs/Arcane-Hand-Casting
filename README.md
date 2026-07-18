# Arcane Handcasting

Browser spell sandbox where webcam-tracked hand geometry creates, charges, aims, and releases magic in a 2D physics arena.

> Your hands are the controller; the magic exists because of the geometry and motion of your hands.

## Status

**Stage 2 — Vision foundation.** Local MediaPipe hand landmarks + mirrored debug overlay on `/sandbox`.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js + TypeScript + Tailwind |
| Hand CV | MediaPipe Tasks Vision (Hand Landmarker) |
| Renderer | PixiJS |
| Physics | Matter.js |
| State | Zustand |
| Audio | Howler.js |
| Tests | Vitest + Playwright |
| Deploy | Vercel |

## Privacy

Webcam frames are processed **locally in the browser**. This MVP does not upload, save, or store camera video.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sandbox placeholder: `/sandbox`.

```bash
npm run test    # unit tests
npm run build   # production build
```

## Repository layout

```text
app/                 # Next.js routes (landing, sandbox)
components/          # menus, tutorial, HUD, calibration
vision/              # camera, MediaPipe, features, quality
game/                # engine, physics, spells, render, audio
public/models|audio|textures/
docs/                # decisions, testing, spell specs
```

## Roadmap (MVP)

1. ~~Project setup~~
2. Vision foundation (camera + landmarks + debug overlay)
3. Hand feature engineering
4. Arena + keyboard controls
5. Ember Orb end-to-end
6. Aegis
7. Tutorial / UX
8. Trial Arena + polish
9. Deploy + portfolio write-up

## Docs

- [Project plan](docs/PROJECT_PLAN.md)
- [Decisions](docs/DECISIONS.md)
- [Testing](docs/TESTING.md)
- [Spell spec](docs/SPELL_SPEC.md)
- [Hand features](docs/HAND_FEATURES.md)
