## 2026-11-24 — A service worker for offline play: network-first page, versioned precache, no update prompt (Builder, #999)

**Context:** Players on a phone should be able to install the game and play it with no signal. A service worker that
serves a stale page ships an old build to every returning player, and one that caches the 404 page or `/api/*` breaks
the site or the online board.
**Decision:** `src/sw/sw.ts` is TypeScript bundled by esbuild in a Vite plugin (`serviceWorker()` in `vite.config.ts`),
not a hand-maintained `public/sw.js`, so its routing is the tested `src/sw/swRoute.ts` itself, not a mirror. The page is
always network-first, falling back to the `index.html` this worker precached and never to one fetched since (a page stored at runtime by the last deploy's worker would sit next to the old build's chunks, and every level it didn't load would fail offline; `keepAtRuntime` stores back only this worker's own precached files); hashed bundles and the precached public files are
cache-first. One cache per build, named after a digest of the precached files' contents: any deploy changes `sw.js`,
which `vercel.json` serves `no-cache` and the page registers with `updateViaCache: 'none'`; the new worker
`skipWaiting`s, claims and deletes the old cache, with no "update available" prompt. A page still running the old build
that then asks for a chunk the new cache lacks falls through to the network, where `app/staleReload.ts` already handles
a removed chunk. It registers only on the Vercel build without `?e2e` (or with `?sw=1`, for prod-check's `offline` check),
never in the portal build. `serviceWorkerEnabled` must not call `isLiveSite`: a second caller stops Rollup folding
`analyticsEnabled` to false in non-Vercel builds and put the analytics code (+3.5 KB gz) back into the startup JS the
bundle budget measures.
**Consequences:** Every online load runs the deployed build. To retire the worker, deploy a `sw.js` that deletes the
`sc-*` caches and calls `self.registration.unregister()`; deleting `sw.js` alone leaves installed workers serving their
cached shell offline only (online they still fetch the page first).
