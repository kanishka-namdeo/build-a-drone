# public — PWA shell

## Purpose
Static assets served at the root: web manifest, service worker, icons, robots.

## Ownership
- `manifest.webmanifest` — installable app metadata (name, colours, icons)
- `sw.js` — cache-first assets, network-first documents; bump `VERSION` on deploy
- `icons/` — `icon.svg` (source of truth) + generated PNGs (192/512)
- `robots.txt`

## Local Contracts
- Icons are generated from one shared shape list; regenerate PNGs when the SVG changes.
- The service worker must never cache-first the HTML document (deploys must appear on reload).

## Verification
- Build + load the app; DevTools > Application shows the SW + manifest without errors

## Child DOX Index
(none)
