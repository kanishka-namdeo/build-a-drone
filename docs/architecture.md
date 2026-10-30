# Architecture

Drone Lab is a single-page, zero-dependency TypeScript app: vanilla DOM + SVG + WebAudio, bundled by Vite. One craft is mounted per page load (hash routing); the whole page (chrome included) is rebuilt on craft switch.

## Layers

```
index.html
  └── src/main.ts                  boot: startLab(crafts, roster) + SW registration
        ├── src/engine/            drawing engine (no craft knowledge)
        │     core.ts              projection, primitives, shading, ink filter, tags
        │     frames.ts            oriented 3D frames (FR.I/T/Rx/Ry/Rz/S)
        │     oshapes.ts           frame-relative solids, wires, glow dots
        │     materials.ts         palettes, wire colours, resistor code
        │     shell.ts             mountFigure(): page chrome + widgets + test hooks
        │     audio.ts             WebAudio synth (sfx, motor hum, lofi bus)
        │     └── storage.ts       localStorage (prefs + per-craft progress)
        ├── src/workshop/          the bench + lesson engine
        │     lab.ts               state machine, scenes, buttons, tests, flight glue
        │     calc.ts              performance model (honours craft overrides)
        │     └── lesson.ts        roster nav, wiring SVG, lesson panels, quiz
        ├── src/flight/            the simulator
        │     physics.ts           multirotor step, battery, wind
        │     world.ts             prims, collision, goals/gates
        │     render.ts            third-person iso + FPV perspective + OSD
        │     └── controls.ts      keyboard + virtual sticks
        └── src/crafts/            13 CraftRecords + registry/roster
```

## Rendering pipeline

Scenes are **SVG strings**. Every frame:

1. `dtick(dt)` advances state (placement animations, tests, physics substeps ≤ 10 ms).
2. `ui.render()` → `dscene()` picks bench / third-person / FPV.
3. The scene sets framing (`setPan`, `ui.setViewBox`, `ui.setInkK`), projects, and returns markup.
4. The shell rebuilds the hand-ink filter (scaled so stroke weights stay constant on screen) and swaps `#art.innerHTML`.

The bench and the flight world share the same isometric engine — the flight world just draws at 1000 px per metre and reframes the viewBox around a smoothed camera every frame. FPV is a separate small perspective renderer (near-plane clipping, painter sort, back-face culling, sun-lit faces) with a white OSD drawn on top.

## The craft contract

`CraftRecord` (src/types.ts) is the entire surface between engine and content:

- **catalogue**: `batts` / `motors` / `props` (grams + dollars), `fixed` parts, default `design`
- **bench**: `parts[]` (build order, prerequisites, explode layer, polar mistakes), `mpos` motor map + `wrongMotor`, `draw(F, add, opt)` + `hull(F)` + `tags`
- **lesson**: `wiring` (nodes + links), `overview`, `buildCode`, `quiz`, `practice`
- **flight**: `modes`, `range` (prims + goals), physics hooks (`calc`, `physics`, `warnings`, `flyStats`, `calcRows`, `extraButtons`)

The engine keys off canonical part ids (`FRAME MOTORS ESC WIRES FC XT60 CAM RX VTX TOP BATT PROPS`) for the fault tests: FC reversed or props swapped flip the quad on take-off; a reversed XT60 vents the cap unless the smoke stopper caught it.

## State + persistence

One mutable `LabState` per mounted craft (design, placement, checks, serial log, quiz, flight). `Progress` persists quiz answers, best laps/runs and visited flags in `localStorage` under `drone-lab:progress`. Audio prefs under `drone-lab:audio`.

## Testing

- **Unit** (Vitest): the calculator's reference numbers, the physics constants (ceiling, battery thresholds, flip faults, gate/goal logic), storage round-trips.
- **E2E** (Playwright): boot, build flow, fly, craft switching — driven through the `?bare=1`, `?fly=`, `?press=` hooks.
- **Manual/visual**: browser screenshots compared against the interaction spec of the original.
