# 🧙‍♂️ Arcane Hand Casting

[![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![MediaPipe](https://img.shields.io/badge/MediaPipe-Vision_WASM-00979D?style=flat-square&logo=google)](https://developers.google.com/mediapipe)
[![Vitest](https://img.shields.io/badge/Vitest-Unit_Tested-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

> A real-time computer vision spellcasting arena powered by webcam hand tracking, MediaPipe WASM landmark detection, custom particle renderers, and interactive physics. Cast magic spells in 3D space using natural hand gestures.

---

## 🌟 Key Features

- **Real-Time MediaPipe Hand Tracking**: Integrates Google MediaPipe WASM (`hand_landmarker.task`) for low-latency 21-keypoint 3D hand tracking directly in the browser via webcam.
- **Gesture-Based Spell Mechanics**: Detects pinch, palm facing, finger beam pointing, and motion vectors to cast distinct spells (Ember Orbs, Pointer Beams, Aegis Shields, Lightning Strikes).
- **Custom Canvas & Particle Renderers**: High-performance visual effects rendered via custom specialized renderers (`AegisRenderer`, `LightningRenderer`, `CameraFireballRenderer`, `TrialRenderer`).
- **Landmark Smoothing & Calibration**: Temporal landmark smoothing algorithms (`landmarkSmoother.ts`) and interactive user camera calibration (`CalibrationPanel.tsx`) to prevent tracking jitter.
- **Interactive Arena & Vision Sandbox**: Practice mode (`/sandbox`) with live debug landmark overlays (`drawDebugOverlay.ts`) and full-fledged gameplay arena (`/arena`).

---

## 🏗️ Repository Architecture

```text
Arcane-Hand-Casting/
├── app/                      # Next.js App Router (/arena, /sandbox, /)
│   ├── arena/                # Full spellcasting battle arena page
│   ├── sandbox/              # Computer vision testing & debugging sandbox page
│   ├── globals.css           # Custom HUD & arcane theme styles
│   └── page.tsx              # Main menu landing page
├── components/               # React UI overlays & HUD components
│   ├── ArenaView.tsx         # Main gameplay arena wrapper
│   ├── CalibrationPanel.tsx  # Camera & gesture calibration interface
│   ├── CameraPermission.tsx  # WebCam stream permission handler
│   ├── GameHud.tsx           # Health, mana, cooldown, and spell HUD
│   └── VisionSandbox.tsx     # Live landmark debug canvas component
├── game/                     # Core game engine, renderers, & spell mechanics
│   ├── config/               # Arena parameters & spell definitions
│   ├── logic/                # Spell cooldowns & casting calculations
│   ├── physics/              # ArenaWorld physics & collision detection
│   ├── render/               # WebGL/Canvas visual effect renderers
│   ├── spells/               # Spell implementations (EmberOrb, PointerBeams, SpellSelect)
│   └── GameController.ts     # Main game loop driver
├── vision/                   # Computer vision processing engine
│   ├── handLandmarker.ts     # MediaPipe WASM initialization & frame processing
│   ├── landmarkSmoother.ts   # Exponential smoothing & jitter reduction
│   ├── palmFacing.ts         # Palm orientation & vector calculation
│   └── drawDebugOverlay.ts   # Debug skeleton & landmark visualizer
├── docs/                     # Specifications (SPELL_SPEC, HAND_FEATURES, COORDINATES)
└── public/models/            # MediaPipe hand landmarker WASM model binary
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js**: `v18.0.0+`
- **npm** or **pnpm**
- **Webcam**: Required for real-time hand gesture tracking.

---

### Local Development Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/ZenzerJs/Arcane-Hand-Casting.git
   cd Arcane-Hand-Casting
   ```

2. **Install dependencies & copy MediaPipe WASM assets**:
   ```bash
   npm install
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open Application**:
   Navigate to [http://localhost:3000](http://localhost:3000) and grant camera permissions when prompted.

---

## 🧪 Testing & Verification

Run the Vitest unit test suite to verify vision normalization, landmark smoothing, and spell mechanics:

```bash
npm run test
```

| Command | Action |
| :--- | :--- |
| `npm run dev` | Launches Next.js dev server with hot reload |
| `npm run build` | Compiles Next.js production build |
| `npm run test` | Runs Vitest unit tests for vision and spell engines |
| `npm run lint` | Runs ESLint for code style enforcement |

---

## 📜 Documentation

Detailed technical design specs are located in `/docs`:
- [`SPELL_SPEC.md`](docs/SPELL_SPEC.md) — Gesture patterns and spell parameters
- [`HAND_FEATURES.md`](docs/HAND_FEATURES.md) — Feature extraction algorithms
- [`COORDINATES.md`](docs/COORDINATES.md) — Normalized screen vs. 3D landmark mapping

---

*Developed by [ZenzerJs](https://github.com/ZenzerJs)*
