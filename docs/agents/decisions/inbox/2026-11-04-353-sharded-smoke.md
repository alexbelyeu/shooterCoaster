## 2026-11-04 — CI smoke runs as parallel shards behind a `verify` gate, with a `smokeSeconds` budget (builder, #353)

**Context:** The smoke ran serially inside the one `verify` job: ~25 min of a 40-min cap, growing with every level,
boss and step, and every PR waited ~30 min for CI. The `main` ruleset requires a check named exactly `verify`.

**Decision:** `ci.yml` runs `unit + build`, `lighthouse` and one `smoke (<shard>)` job per shard in parallel, then a
`verify` job that needs them all and passes only if every one succeeded (it runs when one failed or was cancelled,
and then fails). The shard table is `SHARDS` in pure `e2e/shards.mjs` and the shards are named steps of the one
smoke, not a second runner (`--shard`, `--steps`). `shards.test.ts` holds them to running exactly what the full
`npm run smoke` runs:
`ui` (title, landing, levelSelect, daily, settings), `level1` (ride, frenzy, seed, boss, pickup), `level1-steps` (quality,
pause, countdown, speed, scrim), `level2`…`level5` (every per-level step on that level) and `mobile` (the phone run). Each
shard job builds the commit itself (~30 s), which is quicker than waiting on a shared build job.
New budget `budgets.json` `smokeSeconds`, per shard, checked on CI only (a 2-core session is slower): over budget fails
with `<shard> shard took X min, budget Y`, and a shard still running at twice its budget writes its results and exits
before the 25-min job timeout. The numbers are ~1.4x the smoke time of each shard on #364's first CI run, rounded up to 30 s:

| shard | measured (smoke only) | budget |
|---|---|---|
| ui | 2.1 min | 180 s |
| level1 | 3.3 min | 300 s |
| level1-steps | 5.3 min | 450 s |
| level2 | 5.6 min | 480 s |
| level3 | 4.1 min | 360 s |
| level4 | 2.7 min | 240 s |
| level5 | 1.8 min | 180 s |
| mobile | 7.7 min | 600 s (1.3x: it sets the wall time) |

GitHub creates the `verify` check only when its needs end, so `automerge.cjs` and `studio-status.cjs` treat a head
with CI jobs still running and no `verify` yet as "verify waiting", not "no verify".

**Consequences:** `verify` took 8 min 46 s wall on #364 instead of ~30. A new level needs a shard, a matrix entry in
`ci.yml` and a `smokeSeconds` entry (the unit test fails until all three exist). The phone run (`runMobile`, one
continuous session) is the long pole: the next big addition to it should split it into two shards instead of
raising its budget. Only the Director raises these budgets.
