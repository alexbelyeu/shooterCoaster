## 2026-11-23 — Startup JS 436 → 390 KB gz: lazy screens and framer-motion's `m` (Builder, #861)

**Context:** Startup JS sat at its 436 KB gz budget after five +1 KB raises in four days. framer-motion's full `motion`
component (its whole animation engine) and every screen past the title (level select, Settings, HUD, countdown, pause,
results with its share / score card / leaderboard) were in the entry chunk.
**Decision:** UI code uses framer-motion's `m.*` under `<LazyMotion features={…} strict>` (App.tsx); the features
(`domAnimation`) are a lazy chunk fetched as App mounts. Level select + Settings and the run's screens are two lazy
chunks (`app/lazyScreens.tsx`), preloaded when the title is idle after the level chunk; the loading screen waits for
the run's. `startupJsGzipKB` lowered to 392 (the new 390 + 2).
**Consequences:** Writing `motion.div` throws at runtime (`strict`): use `m.div`. A new screen the title doesn't show
belongs in `menuScreens.ts` or `playScreens.ts`, not as a static import in App. A screen whose chunk fails to load
goes back to the title (Settings closes), where `staleReload.ts` reloads the page (#823, #888). three's chunk (173 KB) is
`three.core` + `three.module` with no `examples/jsm` addon in it: nothing more to tree-shake there short of a renderer swap.
