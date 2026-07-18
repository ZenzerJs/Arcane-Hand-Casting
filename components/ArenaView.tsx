"use client";

import { HandArenaView } from "@/components/HandArenaView";

/**
 * Stage 5 arena entry — hand cast + keyboard fallback.
 * Kept as ArenaView so /arena import path stays stable.
 */
export function ArenaView() {
  return <HandArenaView />;
}
