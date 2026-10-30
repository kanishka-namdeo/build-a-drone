# src/engine — isometric drawing engine

## Purpose
The hand-inked isometric SVG drawing engine + page shell shared by every figure page. No craft-specific logic here.

## Ownership
- `core.ts` — projection (`project`/`projectDir`/`depthOf`/`byDepth`), path helpers, planes, lights/tone, solids (`box3`/`cyl3`/`cylX3`/`rod3`/`loft`/`extrude`), text, cast shadows, boards, `tag()` callouts, the hand-ink SVG filter, ink scaling
- `frames.ts` — oriented 3D frames (`FR.I/T/Rx/Ry/Rz/S/up`, `pt`, `dir`)
- `oshapes.ts` — frame-relative shapes (`obox`, `ocyl`, `odisc`, `otext`), wires (`tube`, `jumper`, `smooth3`), deferred glow dots, `servoPiece`
- `materials.ts` — palettes beyond `PALETTES`, wire colours, resistor code
- `shell.ts` — `mountFigure(cfg)`: page chrome, stats overlay, toast, chips popovers, wobble slider, palette swatches, labels toggle, URL params (`?pal`, `?labels`, `?press`), `?fly`-independent
- `audio.ts` — WebAudio synth: `AudioSys.sfx(name)`, `hum(level)`, lofi music bus, prefs persisted
- `storage.ts` — `Store` + `Progress` (localStorage, prefix `drone-lab:`)

## Local Contracts
- Drawing helpers return SVG strings; scenes compose + depth-sort them.
- One fixed view (front-left-top) and one fixed light; shadows fall lower-left.
- Stroke widths are model units; the shell scales them by `inkScale()` so they stay constant on screen.
- Scenes may reframe via `ui.setViewBox` / `ui.setInkK` / `setPan` before projecting (flight views do this every frame).
- SVG hit targets fire on `pointerdown` (elements are replaced mid-motion), dispatch via `cfg.acts`.

## Work Guidance
- Keep the API terse — craft drawing code ergonomics matter more than abstraction purity.
- New materials go in `materials.ts`; new primitives in `core.ts`/`oshapes.ts` with tests only when the math is subtle.

## Verification
- `npx tsc --noEmit`
- `npm test` (audio/storage suites)

## Child DOX Index
(none)
