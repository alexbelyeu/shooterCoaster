## 2026-11-20 — Total JS is at its 630 KB budget; Ocean's whale no longer fits (builder, #793 / #796)

**Context:** `jsTotalGzipKB` is 630 (645 120 B, gzip level 9 over `dist/assets/*.js`), set when Tone.js left (700 → 630). Ocean's whale breach (#796) first measured 1 872 B and was cut to 1 273 B: its body is a lathe on the shared `paintedParts` helpers, its fins painted polygons, one splash at the crash, and `rideModel`'s speeds come through `BiomeFeaturesProps.speeds` instead of a second `rideModel`. `main` keeps growing under it:
- `main` at 5799adf's merge: 643 839 B (628.75 KB), so the whale fit with 9 B to spare.
- `main` after #804 (merged into the PR as 060522d): **644 662 B (629.55 KB), 458 B of headroom**. With the whale: **645 935 B (630.80 KB), 815 B over**.

The whale is about 1.3 KB of minified code (the breach timing from `rideProfile`, the pose, the geometry, the crash splash and shake). Getting it under 458 B means dropping the feature itself.
**Decision requested (Director):** either raise `jsTotalGzipKB` (to 635 would leave ~3.9 KB for the next few PRs), or name code elsewhere in the game to cut. The PR is a draft and `agent:blocked` until then. `budgets.json` is unchanged.
**Consequences:** Without a raise, any PR adding more than ~450 B of game code fails `check:bundle`, not just this one.
