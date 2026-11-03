## 2026-11-02 — The Giant Scorpion rides along on the sand; a broken tail segment closes up (Builder, #318)

**Context:** Desert's finale. The Kraken surfaces at fixed spots because it needs water; the scorpion can walk, and
the desert track loops over most of the ground ahead of the rider, so a fixed offset (the Blimp's) would often
stand it on the rails or a tower.
**Decision:** It rides like the Blimp (smoothed heading, a fixed distance ahead and to one side) but picks its spot
from a ranked list of [ahead, side] slots on either side (`scorpionMotion.ts` `PERCH`), keeping its current slot
while it stays clear of `trackClearance` (2D, towers included), the landmarks and mesas (`desertObstacles`); it
scuttles to the next clear slot when blocked. Its tail is laid from the live segments only, so breaking any segment
(not just the tip) shortens the tail and the stinger stays on the end, sitting on a bare stub for phase 1. Bosses
now get `incoming` (their tell) as a prop: the scorpion's dune heaves and the desert dust boosts
(`scorpion:burrow`) during it.
**Consequences:** At the highest points of the ride (~480 above the sand) the tail top (~480) is level with the
horizon rather than above it. Any new ground boss should reuse `pickPerch`'s slot approach rather than a fixed offset.
