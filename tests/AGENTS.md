# tests — unit + e2e

## Purpose
Vitest unit tests (calculator numbers, physics constants, storage, audio prefs) and Playwright e2e flows (boot, build, fly, craft switching).

## Ownership
- `unit/` — `calc.test.ts` (reference numbers), `physics.test.ts` (flight constants, gates/goals), `storage.test.ts`, `audio.test.ts`
- `e2e/lab.spec.ts` — 10 Playwright flows against the built app (`npm run preview`): boot, manual pedagogy build path, build-it-for-me, flight, FPV OSD, all-13-crafts boot, hash nav, quiz persistence, live calculator, mobile layout

## Local Contracts
- The reference calculator numbers (514 g AUW, 12.5:1 T:W, 28% hover, 144 A, 12.3/5.2 min, $346) are locked by `calc.test.ts`; change them only with a deliberate spec change.
- Physics constants locked by `physics.test.ts` (12 m ceiling, 3.5/3.2 V battery, flip faults, gate/goal logic).
- e2e uses the `?bare=1`, `?fly=`, `?press=` hooks instead of brittle UI traversal where possible.

## Work Guidance
- New engine math deserves a unit test; new user flows deserve an e2e spec.

## Verification
- `npm test`, `npm run test:e2e`

## Child DOX Index
(none)
