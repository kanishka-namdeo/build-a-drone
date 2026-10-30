# Session checkpoints

Append-only log. One entry per milestone: what changed, how it was verified, how to resume.

---

## Session 1 — 2026-10-30 (Asia/Dubai)

**Task**: clone, setup, run `kanishka-namdeo/build-a-drone`; reverse engineer and re-implement `https://drone-engineer.vercel.app/`; production quality; push per milestone; release with builds when done.

### Checkpoint 1 — Research complete
- Repo was **empty** (no branches) → ground-up build.
- Downloaded the original site (single 500 KB HTML, 19 inline scripts) to `/research/site.html`; split scripts for study.
- Four parallel analysis agents produced full specs: core engine, workshop features, flight physics, 13-craft catalog.
- Visual grounding: 6 screenshots of the original + VLM analysis (layout, palette, widget styling, OSD).
- Fetched agent0ai/dox conventions for the DOX tree.

### Checkpoint 2 — Infrastructure (M0)
- Vite 5 + TypeScript 5 (strict) + Vitest + Playwright toolchain; package.json, tsconfig, index.html, vite.config.
- Infra agent delivered: `engine/audio.ts` (WebAudio synth: 17 sfx, motor hum, lofi loop), `engine/storage.ts` (Store + Progress), PWA (manifest, sw.js cache-first-assets/network-first-docs, icons svg+192+512), CI/e2e/release workflows, LICENSE, .gitignore, playwright.config.
- 18/18 unit tests passing.

### Checkpoint 3 — Engine core (M1)
- `engine/core.ts`: isometric projection (30°), depth sort, path/shape primitives (box3, cyl3, rod3, loft, extrude...), tone shading with fixed light, cast shadows, callout tags, hand-ink SVG filter (feTurbulence displacement + grain), ink scaling.
- `engine/frames.ts` (oriented frames), `engine/oshapes.ts` (obox/ocyl/odisc/otext, tube wires, glow dots), `engine/materials.ts`.
- `engine/shell.ts`: mountFigure page chrome (header/stage/actions/stats/toast/chips/controls), pointerdown act dispatch, `?pal/?labels/?press` test hooks, `wrapRender`, runtime reframing API (setViewBox/setInkK/resetFrame).
- `styles/base.css` paper/ink aesthetic.

### Checkpoint 4 — Workshop + flight + Fig 01 (M2/M3)
- `workshop/calc.ts` (stock model; honours overrides), `workshop/lab.ts` (state machine, bench scene, build/tests/plug buttons, dtick driver, flight glue, hash routing, virtual sticks, fmsg bar), `workshop/lesson.ts` (roster nav, wiring SVG with colour-coded links + legend, lesson panels, persisted quiz).
- `flight/world.ts` (prims, collideAt, goalCheck, gateCheck), `flight/physics.ts` (multirotorStep, batteryStep), `flight/render.ts` (drawWorldIso, drawCraftFlight, goalPointer, fpvScene + OSD), `flight/controls.ts` (keyboard + pads).
- `crafts/quad5.ts` — Fig 01 reference craft (full catalogue, 12 parts, drawing, wiring, quiz, freestyle bando range).
- `styles/lab.css` sidebar layout + panels + sticks.

### Checkpoint 5 — Verified as a user, bugs fixed
Flow-tested via headless browser (agent-browser + VLM screenshot reviews):
- bench → Build it for me → smoke stopper ✓ → motor test ✓ → acc cal ✓ → plug ✓
- fly (alt/angle/acro/race/range) ✓, FPV ✓, arm/climb/forward flight ✓, reset ✓
- wiring diagram + lesson panels + calculator values ✓ (514 g, 12.5:1, $346 — matches original)

Bugs found + fixed:
1. `?bare=1` self-animated parts to placed → now deletes placements.
2. Service worker cached stale deploys → network-first for documents.
3. **Thrust double-multiplied by g** (hover at thrEff 0.009 instead of 0.08) → rewrote force scaling; flip faults now trigger.
4. **Up-vector math wrong** (level quad drifted backward at 14 m/s) → correct Rz·Ry·Rx derivation.
5. Gate laps counted every gate → laps only on re-crossing start/finish (lapStart −1 sentinel).
6. `?fly=` blocked by bench gates → demo hook auto-passes checks.
7. goalCheck runStart falsy-at-0 bug (same sentinel fix).
8. Added off-screen goal pointer (third-person) for range playability.
9. CLI panel pre-wrap.

38/38 unit tests (calc reference numbers, physics constants, gates/goals, storage, audio).

### Checkpoint 6 — Docs + DOX (M6 partial)
- DOX tree: root AGENTS.md + 8 child AGENTS.md (engine, workshop, flight, crafts, tests, public, docs, scripts).
- README.md (landing), docs/architecture.md, this session log.

### Resume notes
- Next: crafts 02–13 via parallel subagents (spec data in `/home/z/my-project/research/` agent reports; follow `src/crafts/AGENTS.md`; use quad5.ts as the template).
- Then: e2e specs, screenshots/media for README, blog post, version bump + release workflow run.
- PAT for pushes: stored in shell env `GH_TOKEN` (do not commit).
