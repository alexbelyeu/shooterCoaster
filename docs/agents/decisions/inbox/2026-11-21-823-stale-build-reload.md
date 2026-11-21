## 2026-11-21 — A deploy mid-session reloads the page, once, between runs (Builder, #823)

**Context:** Vercel deploys are atomic, so a tab opened before a deploy loses the old build's hashed lazy chunks; the
game cached the failed import and played the session with no SFX or music. Skew Protection is a paid feature.
**Decision:** Lazy chunks load through `core/staleBuild.ts` `lazyChunk`, which forgets a failure. A failed import (or
Vite's `vite:preloadError`) makes `app/staleReload.ts` fetch the page again (same origin, `no-store`, at most every
30 s) and compare its module entry script with the running one: only a different entry counts as a new build, so an
outage or offline tab never reloads. The page reloads on the title or level select, or as the player leaves results
(never mid-run, never with initials open; the online submission goes first with `keepalive`), at most once per session
(a sessionStorage guard; no storage, no reload).
**Consequences:** Don't add a bare `import()` that memoises its promise: use `lazyChunk`. A player who taps Replay or
Next on results after a deploy lands on the title of the new build instead.
