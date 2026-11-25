## 2026-11-25 — Challenge limits in their own budgets.json section (Builder, #1058)

**Context:** #1058 measures how easy a run is for the model player (score share, bunching in one aim-assist circle, the boss's
time to kill) and gates them per level. The issue put the limits in `budgets.json` `pacing`, but a level's `knownOver` there
turns every pacing problem into a warning, so excusing an easy level would also excuse a gap; and #937's level PRs edit the
same `pacing` entries in parallel.
**Decision:** The limits live in a separate `challenge` section: `_default` (`baseScoreShareMax` 0.8, `bunchingP90Max` 2,
`bossSecondsMin` 12) under each level's own entry, which only needs `knownOver` (or an override). Bunching counts targets
within 44 px (the blaster's touch snap, `TOUCH_ASSIST_RADIUS_PX`) of one of them in a 720 px tall view, like `MIN_ENEMY_PX`,
so the review's 960×540 and the smoke's 1280×720 agree. The score ceiling is on the base share (the kills' points before the
combo multiplier): the final score the issue named runs 1.7–4.3 times `maxScore` for the model player, so 0.8 of it is out of
any level's reach; it is still reported as `scoreShare`. The base share is what matches Alex's "90–95% of the max is easy"
(measured 77–100%).
**Consequences:** A new world needs no `challenge` entry (the default holds it). Levels over the start limits carry
`knownOver: "#1059"` until #1059 retunes them; the limits are budgets, so only the Director raises them.
