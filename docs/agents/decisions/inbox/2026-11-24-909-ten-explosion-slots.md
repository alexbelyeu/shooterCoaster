## 2026-11-24 — The explosion pool has 10 slots, sized by the busiest boss defeat (builder, #909)

**Context:** The boss-defeat confetti (#907) takes 4 slots of the shared `ParticleExplosion` pool. The Magma Titan's defeat adds its crown's part burst and 4 break bursts: 9 live explosions, and the 8-slot pool recycled the crown's burst early.
**Decision:** `DEATH_SLOTS` is 10: the worst boss defeat (last part + confetti + the boss's own defeat bursts) plus one slot for a kill alongside. `deathStyles.test.ts` adds that up per boss from `TITAN_BREAK_POINTS` and `MEDUSA_DEFEAT_BURST_YS`, so a boss that bursts more fails the test rather than cutting its effects short.
**Consequences:** Two more slots cost ~2k triangles in every level's scene count (the pool's InstancedMeshes are sized for all slots) and no draw calls. A boss given new defeat bursts must add them to the test's table.
