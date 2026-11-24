## 2026-11-24 — Level 6's Shield top is held by late lanternflies, not the Pack (Builder, #957)

**Context:** From the Shield's top (27.9 s) to the bottom of the auto belay's fall (31.5 s) the rider sees no floor, so the
Pack's rats can't be put in frame there (measured in #957's Blocked comment). The review had 3.6 s with nothing to shoot.
**Decision:** The lanternfly swarm runs on past its window: `SWARM_LAST_LATE` 1 → 5.5 s and up to 12 groups
(`SWARM_GROUPS`), with level 6's lanternflies 24 → 36, so groups of three keep landing on the Starr and the Shield the car
looks at from the stop and on the fall. Level 6's `maxScore` goes 2472 → 2652 (`api/_lib/levelLimits.ts` regenerated).
**Consequences:** Lowering `SWARM_LAST_LATE` or the count reopens the gap; check `npm run review -- --level level6` for no
gap over 0.6 s between 20 and 32 s. Level 6's old high scores are now easier to beat by up to 180 points.
