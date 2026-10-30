# DOX framework — build-a-drone

- DOX is the AGENTS.md hierarchy installed in this repo
- Any agent (human or AI) must follow DOX instructions across edits here

## Core Contract

- AGENTS.md files are binding work contracts for their subtrees
- Work products, source materials, instructions, records, assets, and durable docs must stay understandable from the nearest applicable AGENTS.md plus every parent AGENTS.md above it

## Read Before Editing

1. Read the root AGENTS.md (this file)
2. Identify every file or folder you expect to touch
3. Walk from the repository root to each target path
4. Read every AGENTS.md found along each route
5. If a parent AGENTS.md lists a child AGENTS.md whose scope contains the path, read that child and continue from there
6. Use the nearest AGENTS.md as the local contract and parent docs for repo-wide rules
7. If docs conflict, the closer doc controls local work details, but no child doc may weaken DOX

Do not rely on memory. Re-read the applicable DOX chain in the current session before editing.

## Update After Editing

Every meaningful change requires a DOX pass before the task is done.

Update the closest owning AGENTS.md when a change affects:

- purpose, scope, ownership, or responsibilities
- durable structure, contracts, workflows, or operating rules
- required inputs, outputs, permissions, constraints, side effects, or artifacts
- user preferences about behavior, communication, process, organization, or quality
- AGENTS.md creation, deletion, move, rename, or index contents

Update parent docs when parent-level structure, ownership, workflow, or child index changes. Remove stale or contradictory text immediately.

## Project Rules (root-level)

- **Original code only.** This repo is an independent re-implementation of the interaction design of drone-engineer.vercel.app. Never copy code from the original site; study behavior, then write our own. Educational facts (motor sizes, Betaflight commands, physics constants) are fine to reuse.
- **TypeScript strict, zero runtime dependencies.** The app runs on vanilla DOM + SVG + WebAudio. New runtime deps need a strong justification in the PR.
- **Every craft is data + drawing code** implementing `CraftRecord` in `src/types.ts`. Engine code must never special-case an individual craft; craft-specific behavior goes through the record's hooks (`calc`, `physics`, `draw`, `wiring`, `modes`, ...).
- **Units:** millimetres + grams on the bench; metres + kg in flight; z is up; craft-local +x is the nose, +y is the craft's left.
- **Push on every milestone.** Keep commits small and describable.
- **Never delete media assets** (icons, screenshots, diagrams) unless explicitly requested; store them under `assets/media/` or `public/`.
- **Tests:** `npm test` (unit) must pass before push; `npm run build` must typecheck + emit.

## Style

- Keep docs concise, current, and operational
- Document stable contracts, not diary entries
- Put broad rules in parent docs and concrete details in child docs
- Prefer direct bullets with explicit names
- Delete stale notes instead of explaining history

## Closeout

1. Re-check changed paths against the DOX chain
2. Update nearest owning docs and any affected parents or children
3. Refresh every affected Child DOX Index
4. Remove stale or contradictory text
5. Run existing verification when relevant (`npm run typecheck && npm test && npm run build`)
6. Report any docs intentionally left unchanged and why

## Child DOX Index

- [`src/engine/AGENTS.md`](src/engine/AGENTS.md) — isometric drawing engine (projection, shapes, ink, shell, audio, storage)
- [`src/workshop/AGENTS.md`](src/workshop/AGENTS.md) — bench workshop engine (state machine, calculator, lesson panels)
- [`src/flight/AGENTS.md`](src/flight/AGENTS.md) — flight simulator (physics, world, renderers, controls)
- [`src/crafts/AGENTS.md`](src/crafts/AGENTS.md) — the 13 drone definitions + registry
- [`tests/AGENTS.md`](tests/AGENTS.md) — unit + e2e test suites
- [`public/AGENTS.md`](public/AGENTS.md) — PWA shell, icons, service worker
- [`docs/AGENTS.md`](docs/AGENTS.md) — architecture, guides, blog, session checkpoints
- [`scripts/AGENTS.md`](scripts/AGENTS.md) — dev helper scripts
