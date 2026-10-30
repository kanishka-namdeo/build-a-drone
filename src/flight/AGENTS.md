# src/flight — flight simulator

## Purpose
The flying side: multirotor physics, battery model, world + collisions + checkpoints, third-person isometric renderer, FPV perspective renderer + OSD, keyboard + touch controls.

## Ownership
- `physics.ts` — `multirotorStep` (attitude, throttle/alt-hold, forces, ground contact, crashes, geofence, battery), `windAt`, `newFlight`
- `world.ts` — `buildWorld` (prims: box/cyl/tree/pole/gate/house/flat/disc), `collideAt`, `goalCheck`, `gateCheck`
- `render.ts` — `drawWorldIso`, `drawCraftFlight`, `goalPointer`, `fpvScene` + OSD
- `controls.ts` — keyboard state, `readSticks`, `makePad` (virtual sticks)

## Local Contracts
- Units: metres/kg; z up; craft-local +x nose, +y left; +roll banks left.
- Attitude: direct Euler. Acro 540 deg/s; angle/alt limit 38 deg with first-order self-level (k=9); yaw 200 deg/s.
- Thrust accel = `thrEff * (n*thrust_g/auw) * g` along the body up vector — do not double-multiply by g.
- Battery: amps from hoverA scaled by (thrEff/hoverThr^2)^1.25 + 0.4; warn 3.5 V/cell; cutout 3.2 V/cell.
- Bench-scale drawing reuses the engine at 1000 px/m; flight scenes reframe via `ui.setViewBox`/`setInkK` each frame.

## Work Guidance
- Craft physics overrides (`craft.physics`) get a `PhysCtx` with `stock()` for the multirotor step.

## Verification
- `npm test` — `tests/unit/physics.test.ts` locks the constants (ceiling, crashes, flips, drift, battery, gates, goals)

## Child DOX Index
(none)
