# Arcane Handcasting

Browser spell sandbox where webcam-tracked hand geometry creates, charges, aims, and releases magic — no controllers, no buttons.

> Your hands are the controller; the magic exists because of the geometry and motion of your hands.

## Status

**Stage 8+ — Trial arena.** All three spells live on `/arena`, first-run tutorial, wave-based trial mode with score, lives, and hazards.

<!-- TODO: record a short GIF of /arena casting and embed it here -->

## Spells

| Spell | Gesture | Effect |
|---|---|---|
| Void Singularity | Two open palms stacked vertically, pull apart | Black hole with orange/violet event horizon; consumes trial wisps |
| Storm Weave | Hands side by side, fingers spread | Five tip↔tip lightning arcs; strikes trial wisps |
| Aegis Ward | One steady open palm toward camera | Rotating rune ward; blocks diving hazard bolts |

## Trial mode

Press **Begin trial** on `/arena`. Rune wisps drift across the frame — destroy them with the singularity or lightning. Hazard bolts dive toward the bottom of the frame; block them with the Aegis ward or lose one of three lives. Waves grow each clear.

## Stack

| Layer | Choice |
|---|---|
| App | Next.js + TypeScript + Tailwind |
| Hand CV | MediaPipe Tasks Vision (Hand Landmarker) |
| Renderer | PixiJS |
| Physics | Matter.js |
| Tests | Vitest + Playwright |
| Deploy | Vercel |

## Privacy

Webcam frames are processed **locally in the browser**. This MVP does not upload, save, or store camera video.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000):

- `/arena` — live spells + trial mode
- `/sandbox` — vision debug overlay (landmarks, FPS, inference ms)

```bash
npm run test    # unit tests
npm run build   # production build
```

## Deploy

Standard Next.js app — push to GitHub and import into [Vercel](https://vercel.com/new). No environment variables required; the MediaPipe model loads client-side.

## Repository layout

```text
app/                 # Next.js routes (landing, arena, sandbox)
components/          # arena view, tutorial, HUD, calibration
vision/              # camera, MediaPipe, features, quality
game/                # spells, trial mode, Pixi renderers, physics
public/models|audio|textures/
docs/                # decisions, testing, spell specs
```

## Roadmap (MVP)

1. ~~Project setup~~
2. ~~Vision foundation (camera + landmarks + debug overlay)~~
3. ~~Hand feature engineering~~
4. ~~Arena + keyboard controls~~
5. ~~Ember Orb / Void Singularity end-to-end~~
6. ~~Aegis~~
7. ~~Tutorial / UX~~
8. ~~Trial arena + polish~~
9. Device matrix pass (see [Testing](docs/TESTING.md))
10. Deploy + portfolio write-up

## Docs

- [Project plan](docs/PROJECT_PLAN.md)
- [Decisions](docs/DECISIONS.md)
- [Testing](docs/TESTING.md)
- [Spell spec](docs/SPELL_SPEC.md)
- [Hand features](docs/HAND_FEATURES.md)
