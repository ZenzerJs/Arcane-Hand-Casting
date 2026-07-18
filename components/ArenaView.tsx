"use client";

import { HandArenaView } from "@/components/HandArenaView";
import { TutorialOverlay } from "@/components/TutorialOverlay";

/**
 * Stage 5 arena entry — hand cast + keyboard fallback.
 * Kept as ArenaView so /arena import path stays stable.
 */
export function ArenaView() {
  return (
    <>
      <TutorialOverlay />
      <HandArenaView />
    </>
  );
}
