/**
 * Keyboard aim + cast intent for Stage 4.
 * Arrow keys / A-D rotate aim; Space queues a cast request.
 */

export class KeyboardAim {
  /** Radians; 0 = right, increases clockwise in screen space (y down). */
  aimRadians = 0;
  private castRequested = false;
  private left = false;
  private right = false;

  private readonly onKeyDown = (event: KeyboardEvent) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") this.left = true;
    if (event.code === "ArrowRight" || event.code === "KeyD") this.right = true;
    if (event.code === "Space") {
      event.preventDefault();
      this.castRequested = true;
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent) => {
    if (event.code === "ArrowLeft" || event.code === "KeyA") this.left = false;
    if (event.code === "ArrowRight" || event.code === "KeyD") this.right = false;
  };

  attach(target: Window = window): void {
    target.addEventListener("keydown", this.onKeyDown);
    target.addEventListener("keyup", this.onKeyUp);
  }

  detach(target: Window = window): void {
    target.removeEventListener("keydown", this.onKeyDown);
    target.removeEventListener("keyup", this.onKeyUp);
    this.left = false;
    this.right = false;
    this.castRequested = false;
  }

  /**
   * Advance aim from held keys. Returns whether Space was pressed since last poll.
   */
  update(deltaMs: number, turnSpeed: number): { cast: boolean } {
    const turn = (turnSpeed * deltaMs) / 1000;
    if (this.left) this.aimRadians -= turn;
    if (this.right) this.aimRadians += turn;

    const cast = this.castRequested;
    this.castRequested = false;
    return { cast };
  }
}
