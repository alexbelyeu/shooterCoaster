## 2026-11-17 — The gym's lanternflies are its second wave, not its first (Builder, #575)

**Context:** #575 asked to swap level6's first crow wave ("In the Rafters!", at 0 s) for a lanternfly swarm. The gym's
`GYM_WALLS` stand on the hall's perimeter, far off the track's middle: over the first 13 s (up the Tree, camera on the
rafters) only Lagoon N is ever in view within a lanternfly's reading distance (1073 units), for about one second at 5–7 s, and
from 9 to 13 s no wall is. As the first wave the swarm sat ~1000+ units off at the smoke's 10 s probe (6 on screen, largest
10 px: the level6 shard failed), and with dust bunnies first nothing was on screen at 10 s.
**Decision:** The crows keep the opening (the rafters, where no wall or ground enemy reads) and keep the first climbers;
the lanternflies take the second slot (8 s), whose window brings the rider face-on to Alaska at 370–460 units from 14 s,
where `placeWallSwarm` lands them. The second crow wave ("Round the Flame!") is dropped; dust bunnies and the first rats
move up a slot. `maxScore` is unchanged (14 lanternflies and 14 crows at 15 each).
**Consequences:** The swarm lands on the wall where wave 1's climbers are still climbing, so the bugs are shot round the
bystanders. Moving the lanternflies earlier needs a wall the opening can see (the Tree's headwall reads only at 19–21 s).
