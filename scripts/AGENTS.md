# scripts — dev helpers

## Purpose
One-off dev utilities (debugging physics, generating icons, capturing screenshots).

## Ownership
- `debug-flip.ts` — physics probe (throwaway; safe to delete or extend)
- `screenshot.mjs` — capture usage shots into `assets/media/`

## Local Contracts
- Scripts must not be required for the app to build or run.

## Verification
- `npx tsx scripts/<name>.ts` runs clean

## Child DOX Index
(none)
