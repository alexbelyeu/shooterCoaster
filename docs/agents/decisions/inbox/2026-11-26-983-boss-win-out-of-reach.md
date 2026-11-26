## 2026-11-26 — A boss win counts an enemy the run can no longer shoot as gone (Builder, #983)

**Context:** #961 ends the run 3 s after the boss falls only when no enemy is alive. A real run rarely gets there: on
level 4 the Yeti falls with 16 enemies alive and none shootable, so the run rode out 15 s of empty valley. The Director
decided (issue #983, comment of 2026-11-26T06:03) that an enemy the rider can no longer reach counts as gone: no point of
the rest of the run's track within its shootable range (`maxReadableDistance`), followers never gone. Built exactly that
way, level 4 still ran to 60 s: all 16 were within ~400-1900 units of the rider, inside their 1700-3200 readable range,
but behind the seat or behind the valley's snow ridges.

**Decision:** `bossWin.ts` `outOfReach` keeps an enemy only when some point of the ride left has it in range, **in view**
(less than ~78° off the track's heading, cosine 0.2; either way on a backwards stretch) and **in sight** (no terrain over
the line from the eye to its top, `sightClear`). The rider's own spot is the first point, so an enemy in range and in view
now is still never gone; one behind the seat or hidden by the ground can be. The ride left is the profile's from the
current level time plus a quarter. Crows and toucans (`FOLLOWS_RIDER`, `FlapBird`'s fly-back) never count as gone; an
enemy not yet emerged isn't a collision target, so it never counts either. `EnemySpawner` checks every 0.25 s once the boss
falls. Walls and buildings are not modelled, so an interior keeps more enemies than it strictly could: it errs toward
riding on.

**Consequences:** level 4's review run ends at 54 s (the Yeti down at 44.7 s), not 60: the last ~7 s is one snowman scout
that stays at the edge of readable range ahead, in view, until it marches off. Scores, `maxScore` and stars are unchanged.
Tightening the cone or dropping the sight test would cut off enemies a player could still shoot.
