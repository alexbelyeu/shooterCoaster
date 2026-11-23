## 2026-11-23 — A failed lazy chunk recovers by reload, not by retry (Builder, #888)

**Context:** Chromium keeps a failed dynamic `import()` failed for the page's life, so `importWithRetry` (#823) never
reached the network: one dropped request for the level chunk at startup made every PLAY fail back to the title until a
reload. Importing a cache-busted URL (`?retry=1`) does reach the network but is no fix: Rollup reads a shared chunk's
exports under mangled names (`import(x).then(n => n.f1)`), and the world and boss chunks import the level chunk by its
own URL, so they would still fail (tried, #888: `forgetWorldFailures is not a function`).
**Decision:** `importWithRetry` is gone. Any chunk failure (not only a new build) makes `app/staleReload.ts` fetch the
page; if it still serves the game it reloads at a safe moment (title, level select, leaving results), once per session.
**Consequences:** a same-build network blip now costs one reload instead of a dead PLAY button. Don't bring back
same-URL retries or cache-busted imports; the smoke's `chunkRetry` step checks the reload.
