export type TickHandler = (deltaMs: number) => void;

/** RequestAnimationFrame game loop — Stage 4. */
export class GameLoop {
  private running = false;
  private lastTs = 0;
  private rafId = 0;

  constructor(private readonly onTick: TickHandler) {}

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTs = performance.now();
    const frame = (ts: number) => {
      if (!this.running) return;
      const deltaMs = ts - this.lastTs;
      this.lastTs = ts;
      this.onTick(deltaMs);
      this.rafId = requestAnimationFrame(frame);
    };
    this.rafId = requestAnimationFrame(frame);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }
}
