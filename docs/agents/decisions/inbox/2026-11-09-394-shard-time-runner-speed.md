## 2026-11-09 — Smoke shard time budgets scale with the runner's measured speed (Builder, #394)

**Context:** `smoke (level5)` failed `verify` on its `smokeSeconds` budget alone (4.2 vs 4.0 min, every check passing) on
a slow CI runner. Over ~35 CI runs per level shard (7-9 Nov) the same commit's shard took 1.0 min on one runner and
1.9 min on another (level3 up to 2.8 of 3.0), and the time follows the ride's wall ms per rendered frame: ~265-320 on
normal runners, ~440-545 on slow ones. A fixed budget either fails passing PRs on slow runners or is too loose to
catch a real slowdown on a normal one.

**Decision:** The smoke judges a shard's time in pure `e2e/shardTime.mjs`: the budget is multiplied by the ride's ms per
frame over a normal runner's 300 (`NORMAL_RUNNER_MS_PER_FRAME`), clamped to 1..2 (`MAX_RUNNER_SLOWNESS`). Over the
budget but within that allowance passes with a warning annotation; past it, or over budget on a normal-speed runner,
fails as before. Shards with no ride (ui, menus, mobile, level1-steps) keep their plain budget. The watchdog that
stops a stuck shard moved from 2x to 2.5x the budget so it never cuts off a run a slow runner is allowed to finish.
`budgets.json` is unchanged.

**Consequences:** The reference ms per frame and the cap loosen every level shard's budget when changed, so they are
the Director's, like the budgets. A PR that makes the ride render slower on SwiftShader also earns up to 2x time; CI
frame times swing ~2x between runners anyway, so the time budget never could catch that, and real-device frame time
is watched by player telemetry (`playerFrameMs`). Steps, waits and load time a PR adds still fail on a normal runner.
