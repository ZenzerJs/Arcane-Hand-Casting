"use client";

import { HandArenaView } from "@/components/HandArenaView";
import { TutorialOverlay } from "@/components/TutorialOverlay";

/**
 * Arena entry — tutorial overlay + camera hand-cast view.
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
