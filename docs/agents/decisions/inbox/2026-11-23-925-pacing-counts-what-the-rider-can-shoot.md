## 2026-11-23 — Pacing counts what the rider can shoot, played as a player; budgets re-measured (Alex's session, #925)

**Context:** Alex's playtest of level 6 (23 Nov) found 9 s and 16 s stretches with nothing to shoot and the Medusa on screen
for 2 s, on a ride every gate passed. The `pacing` step counted every live enemy whose centre projected into the viewport
(no occlusion, no size limit) on an unfired run, so enemies behind walls, specks across the hall and the leftovers of earlier
waves all counted.

**Decision:** The `pacing` step counts `__SC_TEST__.sight()` (in view, at least `MIN_ENEMY_PX`, a clear line from the camera)
on a run played as a player (`PLAYER_HITS_PER_SECOND`, 3 hits a game second on the nearest shootable targets, on the game
clock, every hit through `processHit`: the shot has its look but no colliding bullet, whose fire interval runs on wall-clock time), and fails a level whose boss is shootable less than its `pacing.bossFramedShare` of the fight. Each level's `pacing`
budget was re-set from its first CI run under the new count (seed 1337) by Alex's session, so nothing gets worse: levels 1–5
on what they measure (#937 has the targets, 3 s / 10% / boss 60%), level 6 on what it measures with its boss floor on the target, `knownOver: "#926"` with `knownOverOnly: "boss"`. Every
PR that changes a ride, its waves, a boss or a level's effects also runs `npm run review` and posts its sheet.

**Consequences:** A pacing number from before #925 is not comparable with one after it. Lowering a level's ceilings toward
the targets, or removing level 6's `knownOver`, is part of the issue that fixes it, not a budget raise. Don't go back to counting projected centres or to an unfired run: both
pass rides a player finds empty.
