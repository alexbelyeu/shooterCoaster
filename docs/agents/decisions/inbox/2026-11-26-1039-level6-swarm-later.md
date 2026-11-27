## 2026-11-26 — Level 6's lanternfly swarm runs 2 s longer, in more groups (Builder, #1039)

**Context:** After #1038 the level 6 review still had 1.3 s with nothing shootable as the car tipped over the top of the
auto belay's fall (30.6 s): the swarm's last group landed at 29.5 s and the pack is out of sight in the pit until 32 s.
**Decision:** `SWARM_LAST_LATE` 5.5 → 7.5 s and `SWARM_GROUPS` 12 → 14, with level 6's lanternflies 36 → 42, so groups
of three still land about a second apart and the last one lands on the fall. The perched dust (24 → 27) and the mats'
rats (22 → 26) hold the cave's entry and the U-turn out of it. Review: 13% → 6% nothing shootable, longest gap 0.7 s.
**Consequences:** Raising `SWARM_LAST_LATE` without more groups spreads them and opens sub-second gaps through the wave
(14% in a run with 12 groups). Level 6's bunching p90 went 4 → 5 (the extra rats in the cave; excused by #1059's
`knownOver`, which retunes it).
