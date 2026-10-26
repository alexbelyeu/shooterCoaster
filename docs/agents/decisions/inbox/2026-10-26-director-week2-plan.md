## 2026-10-26 — Week 2: M1 closed, M2 starts early as "launch week", bosses enter the roadmap (Director)

**Context:** Second Director playtest. Every M1 exit criterion is met on `main` (per-biome
atmosphere + grade + env map, lattice track, readable enemies on 1–3, hit feedback and a
gun, HUD / results / level select, touch, combat screenshots, per-biome modules, vitest).
The first public post goes out Mon 2 Nov (Marketer, #102). The screenshots still show
three things a visitor would screenshot back at us: no visible enemies on Antarctica,
a vertical rail into the sky on levels 4 and 5 (`TrigCurve2` doesn't close), and an
Inferno that is a black triangle on dark red. And a run has no shape: waves are static
scatters, nothing arrives, every level ends on a timer.

**Decision:** M1 is closed a week early and M2 ("the arcade loop and the finale") starts
now, framed as launch week: P1 is whatever makes the first Theme Park run better or
removes a screenshot-worthy bug (the three above, the smoke flake that blocks honest
verification in every cloud session, combo tiers, spawn choreography, fireworks, and the
clip). **Bosses enter the vision**: every level gets a finale through one boss framework
(multi-hit, weak points, HP bar, tell, reward), Theme Park and Ocean first. Alex's
slop-newyork backlog (#126) is split: the launch-safe foundations (perf gate, lazy
Tone.js) become issues now; the feature items (positional SFX, drone orbit, gamepad, photo
mode) are ranked at the top of the VISION backlog for the week after launch; the
structural ones (baked SFX buffers + voice budget, aerial fog, chunk culling, Metropolis,
helicopter boss, Night Ride, WebGPU capability event) sit lower with a trigger each. The issue queue is consolidated: QA follow-ups that touch the same files are
merged into one issue each, fixed bugs are closed, and the total stays near the
~30-issue weekly capacity.

**Consequences:** Builders touching `EnemySpawner`, `EnemyBase` and `CollisionManager`
this week (choreography, death variety, boss framework) must keep the pure parts in
separate modules so parallel PRs don't collide; the boss framework PR goes first and the
two boss issues depend on it. Changing `TrigCurve2` changes the level 4 / 5 track shape,
tower layout and the pinned curve test; the skill's track-extent formula must be
re-checked. The budget stays 700 / 260 KB; the Desert draw-call overage (268 > 250) is a
P2 fix, not a budget raise.
