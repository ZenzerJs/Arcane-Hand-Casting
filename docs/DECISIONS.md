# Architecture decisions

## ADR-001: React owns UI; game engine owns the frame loop

**Status:** Accepted  
**Context:** 60 FPS landmark/physics updates must not re-render React trees every frame.  
**Decision:** React handles menus, tutorial, settings, and HUD sampled at a modest rate. PixiJS + Matter.js own arena entities and per-frame work.  
**Consequences:** Game state lives in TypeScript/Zustand stores updated by the engine; React subscribes sparsely.

## ADR-002: MediaPipe Hand Landmarker in-browser

**Status:** Accepted  
**Context:** Need real-time hands without training a detector or uploading video.  
**Decision:** Use `@mediapipe/tasks-vision` Hand Landmarker locally; engineered features + state machines for spells.  
**Consequences:** Honest ML story (pretrained landmarks + features). Custom sequence classifier is post-MVP only.

## ADR-003: PixiJS + Matter.js

**Status:** Accepted  
**Context:** Need particles/glow and projectile collisions.  
**Decision:** PixiJS for rendering; Matter.js for physics; sync via a shared `GameEntity` abstraction.  
**Consequences:** Keep body counts modest (20–40 dynamic); pool projectiles/particles early if needed.

## ADR-004: Privacy by default

**Status:** Accepted  
**Context:** Webcam is required for the core loop.  
**Decision:** Never transmit, save, or log camera frames. Telemetry (if any) is opt-in aggregate events only.  
**Consequences:** State privacy clearly in onboarding and README.

## ADR-005: Ember Orb before Aegis

**Status:** Accepted  
**Context:** Signature interaction must feel magical before expanding surface area.  
**Decision:** Do not start Aegis until Ember Orb passes its cast reliability gate.  
**Consequences:** Parallel work can still build keyboard-driven arena/VFX.

## ADR-006: Normalize distances by palm width

**Status:** Accepted  
**Context:** Pixel distances change with camera distance and hand size.  
**Decision:** Spell thresholds use palm-width units (`raw / max(palmWidth, eps)`).  
**Consequences:** Calibration and tuning panels expose normalized values.
