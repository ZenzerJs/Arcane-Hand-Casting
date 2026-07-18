# Spell specifications

## Ember Orb (MVP)

### Preconditions

- Two valid hands tracked
- Both reasonably open
- Normalized palm separation ≥ config minimum
- Tracking quality `GOOD`

### States

```text
IDLE → PREPARING → CHARGING → CAST → COOLDOWN → IDLE
PREPARING / CHARGING → CANCELLED → IDLE
```

### Charge

```text
finalCharge = clamp(0.55 * holdCharge + 0.45 * distanceCharge, 0, 1)
orbRadius   = lerp(minRadius, maxRadius, finalCharge)
power       = lerp(minPower, maxPower, finalCharge)
```

### Cast

Requires CHARGING for minimum time, forward palm velocity over threshold for a short window, consistent direction, cooldown clear.

### Visuals

Preparing spark at palm midpoint → charging particles → aim guide → detach projectile → impact burst/shake/SFX.

Tunables live in `game/config/spells.ts`.

## Aegis (MVP)

### Preconditions

- One valid open palm
- Stable hold ~150–250 ms

### Behavior

- Shield at palm center; v1 is screen-facing curved arc
- Persists while pose, energy, and tracking hold
- Blocks incoming arena projectiles

### Enemy support

Slow, readable bolts so the shield has a clear purpose.

## Deferred

- Storm Thread (v1.1)
- Stonebreaker (v1.1)
- Gale Pull (v1.2)
