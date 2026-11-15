## 2026-11-15: Long-run scores leave the leaderboards through a filter, not a wipe (Builder, #458)

**Context:** #452 (merged in #473) cut every run to 60 s. Scores from the old 75–120 s runs are
still in the World `scores` table and in players' local boards, and a 60 s run can't beat them.
**Decision:** Nothing is deleted. The World board and its `rank` count only rows with
`score <= LEVEL_LIMITS[level].maxScore` (`api/_lib/rules.ts` `boardCeiling`). On the device, new
entries carry `ruleset: '60s'`, and the store's persist `merge` drops an entry without it when it
is over the same limit. The store reads the generated `api/_lib/levelLimits.ts` table. Computing
`scoreLimits()` in the store would add the boss specs to the startup JS (+6 KB gz).
Old runs under the limit stay on both boards, because a 60 s run can still beat them.
Stars, unlocks and the Daily record are left alone.
**Consequences:** Alex has no database step to do. The optional SQL to delete the old rows is in
`docs/LEADERBOARD.md`. The board's cut-off follows the generated limits, so a later rebalance
that lowers a level's `maxScore` also hides World rows above the new limit. A rebalance PR has to say so.
