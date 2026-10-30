# docs — architecture, guides, blog, sessions

## Purpose
Durable documentation beyond the DOX tree: how the app works, how to work on it, published articles, and per-session checkpoint logs.

## Ownership
- `architecture.md` — system overview (engine / workshop / flight / crafts layers)
- `guides/` — focused how-tos (adding a craft, the drawing conventions)
- `blog/` — dated articles shipped with releases
- `sessions/SESSIONS.md` — the append-only session checkpoint log

## Local Contracts
- Session checkpoints are appended at every milestone (what changed, how verified, how to resume).
- Blog posts are dated `YYYY-MM-DD-title.md`.

## Work Guidance
- Update `architecture.md` when layer boundaries move, not for cosmetic changes.

## Verification
- Docs referenced from the README resolve (relative links).

## Child DOX Index
(none)
