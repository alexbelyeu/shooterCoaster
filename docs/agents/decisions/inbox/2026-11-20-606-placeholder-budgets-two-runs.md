## 2026-11-20 — A new world's first budgets come from two clean local runs (builder, #552 via #606)

**Context:** The 2026-11-14 entry (#460) had the smoke fill a scaffolded level's `scene` / `pacing` placeholder from
its first local run, whatever that run measured: a run that had already failed (blank frame, stalled loop, truncated
pacing) set the level's permanent ceilings, a missing `stats.scene` saved `null`, and one run is noisier than the
higher-of-two-runs rule the existing ceilings were set by.
**Decision:** (supersedes that entry's "first local smoke") A local run records its numbers in the placeholder's
`runs` only when the level had no other problem (page errors included) and every number is finite; otherwise it
prints `placeholder not set` and writes nothing. The second recorded run sets the ceilings from the higher of the two,
by the same headroom rules. The rule lives in `e2e/placeholderBudget.mjs` (`placeholderAfterRun`), moved there from
`scripts/newWorldPlan.mjs`. No opt-in flag: only a placeholder is ever written, CI never writes, and the builder of a
new world reviews and commits the diff anyway.
**Consequences:** The scaffold's checklist and `docs/LEVEL-KIT.md` say to run the level's shard and its pacing step
twice. A half-filled placeholder (`runs` of one) still fails CI, like an empty one.
