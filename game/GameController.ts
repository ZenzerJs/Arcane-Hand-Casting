/**
 * Owns PixiJS + Matter.js lifecycle and the update loop — Stage 4.
 */

export class GameController {
  async mount(_host: HTMLElement): Promise<void> {
    throw new Error("GameController.mount not implemented — Stage 4");
  }

  update(_deltaMs: number): void {
    // no-op until Stage 4
  }

  destroy(): void {
    // no-op until Stage 4
  }
}
