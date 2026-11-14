## 2026-11-14 — App's screens work round a framer-motion AnimatePresence stall (Builder, #367)

**Context:** The frenzy-end smoke check (and #382 on `main`, #370's portal job) failed with `phase results, results
screens [none]`: the results screen never mounted. Reproduced locally (about every second run that ends while the last
results screen is still fading out, on slow frames): when an exit finishing and a phase change land in one React batch,
`AnimatePresence mode="wait"` restores its stale list of waiting screens and mounts the HUD already leaving. A motion
element mounted mid-exit never runs its exit, so the wait never ends. framer-motion 12.43 behaves the same.

**Decision:** Every screen in App's `AnimatePresence` is a `Screen` (`src/app/Screen.tsx`): a `motion.div` that drops
its `exit` when it mounts leaving, so its presence completes at once and the next screen mounts. The results screen is
keyed per `runId`, so a run ending during the last results screen's fade gets a fresh screen, not that one back.

**Consequences:** A new screen in that `AnimatePresence` must be a `Screen`, not a bare `motion.div`. If a framer
upgrade fixes the stall, `Screen` can go back to `motion.div`; the scratch repro is described in the PR.
