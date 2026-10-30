# src/workshop — bench workshop engine

## Purpose
The build-and-learn loop: part placement, orientation mistakes, safety tests (smoke stopper, motor direction, accelerometer), plug/unplug, exploded view, the calculator, wiring diagram, lesson panels, and the craft page orchestrator.

## Ownership
- `lab.ts` — `startLab`/`mountDrone`: state machine (`LabState`), scenes (`benchScene`/`flyScene`/`fpvSceneWrap`), `dtick` animation driver, buttons, tests, flight integration, hash routing
- `calc.ts` — the performance model (`calcCraft` honours `craft.calc` overrides), tiles, warnings
- `lesson.ts` — side roster nav, wiring diagram SVG, lesson grid panels, quiz recording (persisted)

## Local Contracts
- Canonical part ids the engine keys off: `FRAME MOTORS ESC WIRES FC XT60 CAM RX VTX TOP BATT PROPS` (+ craft-specific ones). `FC`/`XT60`/`PROPS` are polar (orient 1 = the mistake).
- Teaching gates: props last (needs smoke + motor tests), arming needs acc calibration + zero throttle (non-alt modes), flying needs all parts + no fault + smoke test (unless `noSmoke`).
- `?fly=mode` auto-passes the bench gates (demo hook); `?bare=1` empties the bench; `?ex=1` explodes.
- Flight physics substeps at <= 10 ms; the animation loop polls every 120 ms and only animates while busy.

## Work Guidance
- Never special-case a craft here; use the `CraftRecord` hooks.
- Messages are part of the pedagogy: keep the exact guard phrasings unless rewriting deliberately.

## Verification
- `npm test` (calc + physics suites cover the model numbers: 514 g, 12.5:1, $346 defaults)
- Browser flow test: `?bare=1` -> Build it for me -> smoke -> motors -> cal -> plug -> Fly

## Child DOX Index
(none)
