# src/crafts — drone definitions

## Purpose
The 13 figure pages. Each craft is a `CraftRecord` (see `../types.ts`): catalogue data, parts with build order + polarity mistakes, isometric drawing code, wiring map, CLI/log content, quiz, range environment, and optional physics/calc overrides.

## Ownership
- `index.ts` — registry (`crafts` array) + 13-entry `roster` (unimplemented crafts show "soon")
- `quad5.ts` — Fig. 01, the reference implementation; copy its structure for new crafts

## Local Contracts
- Every craft file exports a `CraftRecord`; register it in `index.ts` and fill the matching roster entry.
- Data first: batteries/motors/props tables with grams + dollars; the calculator consumes them.
- Draw in craft-local mm (+x nose); use `opt.U(id)` frames for drop/explode lifts; register pieces via `add(at, svg, id)`.
- Ranges are built from `WorldPrim`s; goals are rings (heading) or spheres.
- Unique mechanics go through hooks: `calc`, `physics`, `modes`, `extraButtons`, `flyStats`, `calcRows`, `warnings`.

## Work Guidance
- Keep drawing quality consistent with `quad5.ts`: hullInk silhouettes, tone shading, cast shadow via `hull()`, tag list for callouts.
- Quiz: 4 questions, exactly one correct option, teaching the page's core lessons.

## Verification
- `npx tsc --noEmit` + `npm run build`
- Load `#/craft-key`, run the bench flow, fly each mode, screenshot

## Child DOX Index
(none)
