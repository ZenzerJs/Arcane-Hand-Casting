/** Shared labels for Matter body.plugin / Pixi display sync. */

export type EntityKind = "orb" | "target" | "wall" | "player";

export type EmberHudState =
  | "IDLE"
  | "PREPARING"
  | "CHARGING"
  | "CAST"
  | "COOLDOWN";

export type ArenaStats = {
  score: number;
  casts: number;
  hits: number;
  targetsLeft: number;
  aimRadians: number;
  cooldownRemainingMs: number;
  emberState: EmberHudState;
  emberCharge: number;
};

export type CastOrbOptions = {
  radius?: number;
  /** Multiplier on base arena orb speed (from Ember power). */
  speedScale?: number;
};
