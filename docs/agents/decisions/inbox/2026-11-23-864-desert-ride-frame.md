## 2026-11-23 — The Desert ride's frame faces the Pyramid; its scorpions come in two packs (Builder, #864)

**Context:** Level 2's v2 ride runs straight at the Pyramid, drops at its foot and rides a passage through tier 1, so the
ride, the passage and the Pyramid have to share one axis. The Pyramid stood axis-aligned at (2000, −1600), off any line
from the middle of the level. With the old wandering curve gone, the straight run to the lift also put all thirty
scorpions of the opening wave in one view: the ride step drew 163 calls against level 2's `scene` budget of 135.

**Decision:** The ride is authored in its own frame, +x from the middle of the level toward the Pyramid
(`landmarks.ts` `RIDE_FRAME`, `PYRAMID.yaw = atan2(1600, 2000)`), and turned into the world; the Pyramid group, its
contact shadow and the canyon's mesas turn with it. `desertLevel.ts` ships the points in that frame (straights repeat
there, so they gzip smaller) and turns them on load. The opening wave is split into two scorpion packs, 12 at GO and 18
at 11 s on the sand before the door, rather than raising the budget: the ride step (at 10 s, with the crow V below in
view) then draws 127.

**Consequences:** Anything placed relative to the ride (the passage, the canyon) is written in the ride's frame and
mapped with `rideFrameToWorld`. Level 2's roster has five waves; `maxScore` is unchanged. The climb's crest (9–10 s) is
pitched at the sky with no scorpion in view, so nine of the 78 crows come as their own V at 5 s, over the crest
(#925's line-of-sight pacing gate; `spawnPlacement.test.ts` #494 counts the packs and that V together, every second).
